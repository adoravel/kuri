/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { defineCommand } from "@kuristina/commands/core";
import { ownerOnly } from "@kuristina/commands/core";
import { requestRestart } from "@kuristina/discord-bot/restart";
import { git } from "@kuristina/core/ops/git";
import { spawn } from "@kuristina/core";

export default defineCommand({
	aliases: ["update", "pull"],
	description: "Pulls the latest commits (fast-forward only, aborts on a dirty tree) and restarts.",
	category: "dev",
	middleware: [ownerOnly],
	async exec(ctx) {
		const fetched = await git.fetch();
		if (!fetched.success) {
			return void await ctx.error(`\`git fetch\` failed:\n\`\`\`\n${fetched.stderr}\n\`\`\``);
		}

		const behind = await git.behindCount();
		if (behind === null) {
			return void await ctx.error(
				"couldn't determine how far behind upstream we are; is the tracking branch set up? <a:angie:1462638355018809590>",
			);
		}
		if (behind === 0) {
			return void await ctx.reply({
				content: "already up to date ig <:snackstare:1508480379198111764>",
			});
		}

		if (await git.isDirty()) {
			return void await ctx.error(
				"working tree has uncommitted changes; refusing to pull to avoid clobbering them. clean it up first mate",
			);
		}

		const changedFiles = await git.pendingChangedFiles();
		const pulled = await git.pullFastForward();
		if (!pulled.success) {
			return void await ctx.error(
				`\`git pull --ff-only\` failed (likely diverged history):\n\`\`\`\n${pulled.stderr}\n\`\`\``,
			);
		}

		if (changedFiles.some((f) => f === "deno.json" || f === "deno.lock")) {
			await ctx.reply({ content: "dependencies changed, re-caching before restart..." });
			const cached = await spawn(Deno.execPath(), { args: ["install"], timeoutMs: 120_000 });
			if (!cached.success) {
				return void await ctx.error(
					`\`deno install\` failed after pull, code is updated but deps aren't cached:\n` +
						`\`\`\`\n${cached.stderr}\n\`\`\``,
				);
			}
		}

		const sha = await git.currentSha();
		await requestRestart(
			ctx,
			`updated to \`${sha}\` (${behind} commit${
				behind > 1 ? "s" : ""
			} pulled), restarting...[ᅟ](https://klipy.com/gifs/entrosar-resenhar)`,
		);
	},
});
