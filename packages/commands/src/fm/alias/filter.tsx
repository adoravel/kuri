/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import { allowedAliasManagers } from "./shared.tsx";

export default defineCommand({
	aliases: ["list", "ls"],
	surfaces: "text",
	description: "Lists all Last.fm artist aliases, optionally filtered by canonical name.",
	middleware: [allowedAliasManagers()],
	args: {
		canonical: arg.string({
			description: "filter by canonical artist name",
			required: false,
			greedy: true,
		}),
	},
	async exec(ctx) {
		const result = await ctx.services.repos.artistAliases.getAll();
		if (!result.ok) {
			return void await ctx.error(`failed to fetch aliases: ${result.error.message}`);
		}

		let aliases = result.value;

		if (ctx.args.canonical) {
			const filter = ctx.args.canonical.trim().toLowerCase();
			aliases = aliases.filter((a) => a.nameKey.includes(filter));
		}

		if (!aliases.length) {
			return void await ctx.reply({
				content: ctx.args.canonical
					? `no aliases found for "${ctx.args.canonical}"`
					: "no aliases found in the database",
			});
		}

		const groups = new Map<
			number,
			{ displayName: string; aliases: string[]; source: string; skipAutocorrect: boolean }
		>();

		for (const alias of aliases) {
			if (!groups.has(alias.groupId)) {
				groups.set(alias.groupId, {
					displayName: alias.displayName,
					aliases: [],
					source: alias.source,
					skipAutocorrect: alias.skipAutocorrect,
				});
			}
			groups.get(alias.groupId)!.aliases.push(alias.displayName);
		}

		const output = [...groups.values()].map((g) => {
			const sourceIcon = g.source === "manual" ? "📝" : "🔄";
			const skipIcon = g.skipAutocorrect ? " ⛔" : "";
			const aliases = g.aliases.filter((a) => a !== g.displayName);
			return aliases.length
				? `${sourceIcon} **${g.displayName}**${skipIcon} → ${aliases.join(", ")}`
				: `${sourceIcon} **${g.displayName}**${skipIcon} (no aliases)`;
		}).join("\n");

		await ctx.reply({
			content: `**Artist Aliases** (${aliases.length} total)\n\n${output}`,
		});
	},
});
