/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Executor } from "../connection.ts";
import type { JsonPrimitive, JsonValue, RowChange } from "./types.ts";
import { MAX_PAGE_SIZE } from "./constants.ts";
import { assertEditableTable } from "./guard.ts";
import { tableMetadata } from "./metadata.ts";

type Row = Record<string, JsonValue>;

function filtered(db: Executor, table: string, filter: Record<string, string>) {
	let query = db.selectFrom(table as never).selectAll();
	for (const [column, value] of Object.entries(filter)) {
		query = query.where(column as never, "=", value as never);
	}
	return query;
}

export async function countRows(db: Executor, table: string): Promise<number> {
	assertEditableTable(table);
	const row = await db.selectFrom(table as never)
		.select((eb) => eb.fn.countAll<number>().as("count"))
		.executeTakeFirst() as { count?: number } | undefined;
	return Number(row?.count ?? 0);
}

export async function fetchRows(
	db: Executor,
	table: string,
	opts: { limit: number; offset: number },
): Promise<Row[]> {
	assertEditableTable(table);
	const rows = await db.selectFrom(table as never)
		.selectAll()
		.limit(Math.min(opts.limit, MAX_PAGE_SIZE))
		.offset(Math.max(opts.offset, 0))
		.execute();
	return rows as Row[];
}

export async function findMatchingRows(
	db: Executor,
	table: string,
	filter: Record<string, string>,
	limit = MAX_PAGE_SIZE,
): Promise<Row[]> {
	assertEditableTable(table);
	const rows = await filtered(db, table, filter)
		.limit(Math.min(limit, MAX_PAGE_SIZE))
		.execute();
	return rows as Row[];
}

async function withPrimaryKeys(
	db: Executor,
	table: string,
	rows: readonly Row[],
	after: (row: Row) => Row | null,
): Promise<RowChange[]> {
	const { primaryKeys } = await tableMetadata(db, table);

	return rows.map((row) => ({
		table,
		pk: Object.fromEntries(
			primaryKeys.map((column) => [column, row[column] as JsonPrimitive]),
		),
		before: row,
		after: after(row),
	}));
}

export function buildDeleteChanges(
	db: Executor,
	table: string,
	rows: readonly Row[],
): Promise<RowChange[]> {
	return withPrimaryKeys(db, table, rows, () => null);
}

export function buildSetChanges(
	db: Executor,
	table: string,
	rows: readonly Row[],
	changes: Row,
): Promise<RowChange[]> {
	return withPrimaryKeys(db, table, rows, (row) => ({ ...row, ...changes }));
}
