/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import { allowedAliasManagers } from "./shared.tsx";

export default defineCommand({
	aliases: ["skip", "autocorrect"],
	surfaces: "text",
	description: "Toggles skip_autocorrect for an artist (prevents Last.fm autocorrect).",
	middleware: [allowedAliasManagers()],
	args: {
		name: arg.string({ description: "artist name", required: true }),
		value: arg.boolean({
			description: "enable or disable skip_autocorrect (default: true)",
			required: false,
		}),
	},
	async exec(ctx) {
		const name = ctx.args.name.trim();
		const enabled = ctx.args.value ?? true;

		const result = await ctx.services.repos.artistAliases.setSkipAutocorrect(name, enabled);
		if (!result.ok) {
			return void await ctx.error(`failed to update: ${result.error.message}`);
		}

		const group = await ctx.services.repos.artistAliases.getGroup(name);
		if (!group.ok) {
			return void await ctx.success(`skip_autocorrect = ${enabled} for "${name}"`);
		}

		await ctx.success(
			`skip_autocorrect = ${enabled} for "${name}"\n-# group: ${group.value.join(", ")}`,
		);
	},
});
