/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { sql } from "@kysely/kysely";
import type { Executor } from "../connection.ts";
import { assertEditableTable } from "./guard.ts";
import type { ColumnInfo, JsonValue, TableMetadata, UniqueConstraint } from "./types.ts";

const cache = new Map<string, TableMetadata>();

function normaliseType(sqliteType: string): string {
	const upper = sqliteType.toUpperCase();
	if (upper.includes("INT")) return "integer";
	if (upper.includes("CHAR") || upper.includes("TEXT") || upper.includes("CLOB")) return "text";
	if (upper.includes("BLOB")) return "blob";
	if (upper.includes("REAL") || upper.includes("FLOA") || upper.includes("DOUB")) return "real";
	if (upper.includes("BOOLEAN")) return "boolean";
	return upper;
}

function normaliseDefault(raw: unknown): ColumnInfo["defaultValue"] {
	if (raw === null || raw === undefined) return null;
	if (typeof raw !== "string") return raw as ColumnInfo["defaultValue"];

	const trimmed = raw.trim();
	if (trimmed === "NULL") return null;
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;

	const quoted = trimmed.match(/^['"](.*)['"]$/);
	return quoted ? quoted[1] : trimmed;
}

async function introspectColumns(db: Executor, table: string): Promise<ColumnInfo[]> {
	const { rows } = await sql<{
		name: string;
		type: string;
		notnull: number;
		dflt_value: unknown;
		pk: number;
	}>`PRAGMA table_info(${sql.raw(table)})`.execute(db);

	return rows.map((row) => ({
		name: row.name,
		type: normaliseType(row.type),
		notNull: row.notnull === 1,
		defaultValue: normaliseDefault(row.dflt_value),
		isPrimaryKey: row.pk > 0,
		primaryKeyPosition: row.pk,
	}));
}

async function introspectUniqueConstraints(
	db: Executor,
	table: string,
): Promise<UniqueConstraint[]> {
	const { rows } = await sql<{ name: string; sql: string | null }>`
		SELECT name, sql FROM sqlite_master
		WHERE type = 'index' AND sql LIKE '%UNIQUE%' AND tbl_name = ${table}
	`.execute(db);

	const constraints: UniqueConstraint[] = [];
	for (const row of rows) {
		const match = row.sql?.match(/\(([^)]+)\)/);
		if (!match) continue;
		constraints.push({
			name: row.name,
			columns: match[1].split(",").map((c) => c.trim().replace(/["']/g, "")),
		});
	}
	return constraints;
}

export async function tableMetadata(db: Executor, table: string): Promise<TableMetadata> {
	assertEditableTable(table);

	const cached = cache.get(table);
	if (cached) return cached;

	const [columns, uniqueConstraints] = await Promise.all([
		introspectColumns(db, table),
		introspectUniqueConstraints(db, table),
	]);

	if (!columns.length) throw new Error(`"${table}" has no columns; does it exist?`);

	const primaryKeys = columns
		.filter((c) => c.isPrimaryKey)
		.sort((a, b) => a.primaryKeyPosition - b.primaryKeyPosition)
		.map((c) => c.name);

	const metadata: TableMetadata = {
		name: table,
		columns,
		columnNames: columns.map((c) => c.name),
		primaryKeys,
		uniqueConstraints,
	};

	cache.set(table, metadata);
	return metadata;
}

export async function tableMetadataFor(
	db: Executor,
	tables: Iterable<string>,
): Promise<Map<string, TableMetadata>> {
	const entries = await Promise.all(
		[...tables].map(async (table) => [table, await tableMetadata(db, table)] as const),
	);
	return new Map(entries);
}

export function getRequiredColumns(metadata: TableMetadata): string[] {
	const rowidAlias = metadata.primaryKeys.length === 1 &&
			metadata.columns.find((c) => c.name === metadata.primaryKeys[0])?.type === "integer"
		? metadata.primaryKeys[0]
		: null;

	return metadata.columns
		.filter((c) => {
			if (c.name === rowidAlias) return false;
			return c.isPrimaryKey || (c.notNull && c.defaultValue === null);
		})
		.map((c) => c.name);
}

export function coerceValue(value: unknown, column: ColumnInfo): JsonValue {
	if (value === null || value === undefined) {
		return column.notNull && column.defaultValue !== null ? column.defaultValue : null;
	}

	const str = String(value);
	switch (column.type) {
		case "integer": {
			if (str === "") return null;
			const num = Number(str);
			if (Number.isInteger(num)) return num;
			try {
				return BigInt(str);
			} catch {
				return null;
			}
		}
		case "real": {
			const num = Number(str);
			return Number.isFinite(num) ? num : null;
		}
		case "boolean": {
			const lower = str.toLowerCase();
			if (["true", "1", "t", "yes"].includes(lower)) return true;
			if (["false", "0", "f", "no"].includes(lower)) return false;
			return null;
		}
		case "blob":
			try {
				return JSON.parse(str);
			} catch {
				return str;
			}
		default:
			return str;
	}
}
