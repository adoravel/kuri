/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand, ownerOnly } from "@kuristina/commands/core";
import { createPlan } from "@kuristina/database/admin";
import { confirmAndApply } from "../dev/database/shared.tsx";

const MAX_PRUNE_ROWS = 65535;

export default defineCommand({
	aliases: ["prune", "adios"],
	description:
		"Deletes low-count (default: count<=1) chain entries / one-off phrases that add noise.",
	category: "owner",
	cooldownMs: 5000,
	middleware: [ownerOnly],
	args: {
		count: arg.integer({
			description: "prune entries with count <= this (default 1)",
			minValue: 0,
		}),
	},
	async exec(ctx) {
		const minCount = ctx.args.count ?? 1;

		const rows = await ctx.resolve(ctx.services.repos.markov.findNoise(minCount));
		if (!rows) return;

		if (!rows.length) {
			return void await ctx.reply({ content: `nothing to prune at count <= ${minCount}` });
		}
		if (rows.length > MAX_PRUNE_ROWS) {
			return void await ctx.error(
				`count <= ${minCount} matches ${rows.length} rows, which is too many to preview/undo ` +
					`safely (cap: ${MAX_PRUNE_ROWS}). raise the min count to shrink the match set`,
			);
		}

		await confirmAndApply(
			ctx,
			createPlan(
				`prune markov_chain entries with count <= ${minCount} (${rows.length} rows)`,
				rows.map((row) => ({
					table: "markov_chain",
					pk: { id: row.id },
					before: { ...row },
					after: null,
				})),
			),
		);
	},
});
