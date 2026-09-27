/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import { allowedAliasManagers } from "./shared.tsx";

export default defineCommand({
	aliases: ["inspect", "view"],
	surfaces: "text",
	description: "Shows detailed alias information for a given artist name.",
	middleware: [allowedAliasManagers()],
	args: {
		name: arg.string({ description: "artist name to inspect", required: true }),
	},
	async exec(ctx) {
		const name = ctx.args.name.trim();

		const [groupResult, canonicalResult] = await Promise.all([
			ctx.services.repos.artistAliases.getGroup(name),
			ctx.services.repos.artistAliases.getCanonical(name),
		]);

		if (!groupResult.ok) {
			return void await ctx.error(`failed to fetch group: ${groupResult.error.message}`);
		}

		if (!canonicalResult.ok) {
			return void await ctx.error(`failed to fetch canonical: ${canonicalResult.error.message}`);
		}

		const group = groupResult.value;
		const canonical = canonicalResult.value;

		if (group.length === 1 && group[0] === name) {
			return void await ctx.reply({
				content: `**${name}**\n-# no aliases found`,
			});
		}

		const isCanonical = canonical === name;
		const lines: string[] = [
			`**${name}**`,
			`${isCanonical ? "✅" : "📎"} Canonical: **${canonical}**`,
			"",
			"**Group members:**",
			...group.map((m) => (m === canonical ? `  ✅ ${m} (canonical)` : `  📎 ${m}`)),
		];

		await ctx.reply({
			content: lines.join("\n"),
		});
	},
});
