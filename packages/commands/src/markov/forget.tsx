/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand, ownerOnly } from "@kuristina/commands/core";
import { createPlan, type RowChange } from "@kuristina/database/admin";
import { confirmAndApply } from "../dev/database/shared.tsx";

const MAX_FORGET_ROWS = 65535;
const MIN_PATTERN_LENGTH = 3;

export default defineCommand({
	aliases: ["forget", "forgor"],
	description: "Removes words and chain entries containing the given string from markov's memory.",
	category: "owner",
	cooldownMs: 2000,
	middleware: [ownerOnly],
	args: {
		pattern: arg.string({
			description: "substring to forget (min 3 characters)",
			required: true,
			minLength: MIN_PATTERN_LENGTH,
			greedy: true,
		}),
	},
	async exec(ctx) {
		const pattern = ctx.args.pattern.trim();
		if (pattern.length < MIN_PATTERN_LENGTH) {
			return void await ctx.error(
				`gimme a string at least ${MIN_PATTERN_LENGTH} characters long to forget`,
			);
		}

		const matches = await ctx.resolve(ctx.services.repos.markov.findMatching(pattern));
		if (!matches) return;

		const { chain, words } = matches;
		const total = chain.length + words.length;

		if (!total) {
			return void await ctx.reply({ content: `nothing in markov's memory matches "${pattern}"` });
		}
		if (total > MAX_FORGET_ROWS) {
			return void await ctx.error(
				`"${pattern}" matches ${total} rows, which is too many to preview/undo safely ` +
					`(cap: ${MAX_FORGET_ROWS}). narrow the pattern`,
			);
		}

		const changes: RowChange[] = [
			...chain.map((row) => ({
				table: "markov_chain",
				pk: { id: row.id },
				before: { ...row },
				after: null,
			})),
			...words.map((row) => ({
				table: "markov_words",
				pk: { word: row.word },
				before: { ...row },
				after: null,
			})),
		];

		await confirmAndApply(
			ctx,
			createPlan(
				`forget "${pattern}" (${chain.length} chain entries, ${words.length} words)`,
				changes,
			),
		);
	},
});
