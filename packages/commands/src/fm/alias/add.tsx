/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import { allowedAliasManagers } from "./shared.tsx";

export default defineCommand({
	aliases: ["add", "create"],
	surfaces: "text",
	description: "Adds a Last.fm artist alias. Group ID is auto-inferred.",
	middleware: [allowedAliasManagers()],
	args: {
		canonical: arg.string({ description: "the canonical artist name", required: true }),
		alias: arg.string({ description: "the alias name", required: true }),
	},
	async exec(ctx) {
		const canonical = ctx.args.canonical.trim();
		const alias = ctx.args.alias.trim();

		if (!alias || !canonical) {
			return void await ctx.error("both alias and canonical names are required");
		}

		const result = await ctx.services.repos.artistAliases.link(alias, canonical, "manual");
		if (!result.ok) {
			return void await ctx.error(`failed to add alias: ${result.error.message}`);
		}

		const group = await ctx.services.repos.artistAliases.getGroup(canonical);
		if (!group.ok) {
			return void await ctx.success(`added alias "${alias}" → "${canonical}"`);
		}

		await ctx.success(
			`added alias "${alias}" → "${canonical}"\n-# group: ${group.value.join(", ")}`,
		);
	},
});
