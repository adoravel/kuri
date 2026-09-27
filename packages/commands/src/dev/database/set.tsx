/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { defineCommand, ownerOnly, string } from "@kuristina/commands/core";
import {
	assertEditableTable,
	buildSetChanges,
	coerceValue,
	createPlan,
	findMatchingRows,
	MAX_PLAN_ROWS,
	parseKeyValuePairs,
	tableMetadata,
} from "@kuristina/database/admin";
import { confirmAndApply, evaluateValue, reportCommandError } from "./shared.tsx";

export default defineCommand({
	aliases: "set",
	description: "Updates specific columns on a row. Shows a diff and asks for confirmation.",
	args: {
		table: string({ description: "table name", required: true }),
		where: string({
			description: "column=value filter, comma-separated for multiple columns",
			required: true,
		}),
		changes: string({
			description: "column=value pairs, comma-separated",
			required: true,
			greedy: true,
		}),
	},
	async exec(ctx) {
		const db = ctx.services.db;
		try {
			assertEditableTable(ctx.args.table);

			const filter = parseKeyValuePairs(ctx.args.where);
			if (!filter.ok) return void await ctx.error(filter.error);

			if (!Object.keys(filter.value).length) {
				return void await ctx.error("give me a filter like `discord_id=..,provider=..`");
			}

			const rows = await findMatchingRows(db, ctx.args.table, filter.value, MAX_PLAN_ROWS + 1);
			if (!rows.length) {
				return void await ctx.error(
					`no rows in \`${ctx.args.table}\` match ${JSON.stringify(filter.value)}`,
				);
			}
			if (rows.length > MAX_PLAN_ROWS) {
				return void await ctx.error(
					`that filter matches more than ${MAX_PLAN_ROWS} rows. narrow it before updating`,
				);
			}

			const rawChanges = parseKeyValuePairs(ctx.args.changes);
			if (!rawChanges.ok) return void await ctx.error(rawChanges.error);

			if (!Object.keys(rawChanges.value).length) {
				return void await ctx.error("give me at least one column=value change");
			}

			const schema = await tableMetadata(db, ctx.args.table);
			const coerced: Record<string, unknown> = {};
			for (const [col, raw] of Object.entries(rawChanges.value)) {
				const columnInfo = schema.columns.find((c) => c.name === col);
				if (!columnInfo) {
					return void await ctx.error(`"${col}" doesn't exist in table "${ctx.args.table}"`);
				}
				coerced[col] = coerceValue(evaluateValue(raw), columnInfo);
			}

			const changes = await buildSetChanges(db, ctx.args.table, rows, coerced as never);
			const plan = createPlan(
				`set ${ctx.args.table} where ${ctx.args.where}: ${ctx.args.changes} (${rows.length} row${
					rows.length === 1 ? "" : "s"
				})`,
				changes,
			);

			await confirmAndApply(ctx, plan);
		} catch (e) {
			await reportCommandError(ctx, e);
		}
	},
	middleware: [ownerOnly],
});
