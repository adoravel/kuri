/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { defineCommand, ownerOnly, string } from "@kuristina/commands/core";
import {
	assertEditableTable,
	buildDeleteChanges,
	createPlan,
	findMatchingRows,
	MAX_PLAN_ROWS,
	parseKeyValuePairs,
} from "@kuristina/database/admin";
import { confirmAndApply, reportCommandError } from "./shared.tsx";

export default defineCommand({
	aliases: "delete",
	description: "Deletes a row. Shows a diff and asks for confirmation.",
	args: {
		table: string({ description: "table name", required: true }),
		where: string({
			description:
				"column=value filter, comma-separated for multiple columns. not required to be the primary key",
			required: true,
		}),
	},
	async exec(ctx) {
		const db = ctx.services.db;
		try {
			assertEditableTable(ctx.args.table);
			const filter = parseKeyValuePairs(ctx.args.where);

			if (!filter.ok) {
				return await ctx.error(filter.error);
			}
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
					`that filter matches more than ${MAX_PLAN_ROWS} rows. narrow it before deleting`,
				);
			}

			const changes = await buildDeleteChanges(db, ctx.args.table, rows);
			const plan = createPlan(
				`delete ${ctx.args.table} where ${ctx.args.where} (${rows.length} row${
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
