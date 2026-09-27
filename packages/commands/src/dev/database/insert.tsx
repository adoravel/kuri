/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { defineCommand, ownerOnly, string } from "@kuristina/commands/core";
import {
	assertEditableTable,
	createPlan,
	getRequiredColumns,
	tableMetadata,
} from "@kuristina/database/admin";
import { confirmAndApply, evaluateValues, parseKeyValues, reportCommandError } from "./shared.tsx";

export default defineCommand({
	aliases: "insert",
	description: "Inserts a new row. Shows a diff and asks for confirmation.",
	args: {
		table: string({ description: "table name", required: true }),
		values: string({
			description: "column=value pairs, comma-separated",
			required: true,
			greedy: true,
		}),
	},
	async exec(ctx) {
		try {
			assertEditableTable(ctx.args.table);

			const rawValues = parseKeyValues(ctx.args.values);
			const values = evaluateValues(rawValues);

			const schema = await tableMetadata(ctx.services.db, ctx.args.table);
			const columns = schema.columnNames;

			const data: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(values)) {
				if (!columns.includes(k)) {
					return void await ctx.error(`"${k}" doesn't exist in table "${ctx.args.table}"`);
				}
				data[k] = v;
			}

			const required = getRequiredColumns(schema);
			const missing = required.filter((col) => !(col in data));
			if (missing.length) {
				return void await ctx.error(
					`missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
				);
			}

			const plan = createPlan(`insert into ${ctx.args.table}`, [
				{ table: ctx.args.table, pk: {}, before: null, after: data as any },
			]);

			await confirmAndApply(ctx, plan);
		} catch (e) {
			await reportCommandError(ctx, e);
		}
	},
	middleware: [ownerOnly],
});
