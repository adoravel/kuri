/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { defineCommand, ownerOnly, string } from "@kuristina/commands/core";
import { runPaginator } from "@kuristina/commands/core";
import {
	type AdminEditableTable,
	assertEditableTable,
	countRows,
	fetchRows,
	MAX_PAGE_SIZE,
	REDACTED_COLUMNS,
	tableMetadata,
} from "@kuristina/database/admin";
import { reportCommandError } from "./shared.tsx";

const formatRows = (
	rows: Record<string, unknown>[],
	columns: string[],
	table: AdminEditableTable,
): string => {
	const redacted = REDACTED_COLUMNS[table] ?? [];

	const safe = rows.map((r) =>
		Object.fromEntries(
			Object.entries(r)
				.filter(([k]) => columns.includes(k) && !redacted.includes(k))
				.map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]),
		)
	);

	const body = JSON.stringify(safe, null, 2);
	return body.length > 1700 ? body.slice(0, 1697) + "…" : body;
};

export default defineCommand({
	aliases: ["inspect", "browse"],
	description: "Browses rows in an admin-editable table, paginated.",
	args: { table: string({ description: "table name", required: true }) },
	async exec(ctx) {
		try {
			assertEditableTable(ctx.args.table);
			const table = ctx.args.table;
			const db = ctx.services.db;

			const total = await countRows(db, table);
			const totalPages = Math.max(1, Math.ceil(total / MAX_PAGE_SIZE));

			await runPaginator(ctx, {
				id: "db-inspect",
				totalPages,
				renderPage: async (page) => {
					const [rows, schema] = await Promise.all([
						fetchRows(db, table, { limit: MAX_PAGE_SIZE, offset: page * MAX_PAGE_SIZE }),
						tableMetadata(db, table),
					]);
					const columns = schema.columnNames;

					return {
						content: `**${table}:** page ${page + 1}/${totalPages} (${total} rows)\n\`\`\`json\n${
							rows.length ? formatRows(rows, columns, table) : "(no rows)"
						}\n\`\`\``,
					};
				},
				ephemeral: true,
			});
		} catch (e) {
			await reportCommandError(ctx, e);
		}
	},
	middleware: [ownerOnly],
});
