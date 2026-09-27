/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export type JsonPrimitive = string | number | boolean | bigint | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ColumnInfo {
	name: string;
	type: string;
	notNull: boolean;
	defaultValue: JsonValue | null;
	isPrimaryKey: boolean;
	primaryKeyPosition: number;
}

export interface UniqueConstraint {
	name: string;
	columns: string[];
}

export interface TableMetadata {
	name: string;
	columns: ColumnInfo[];
	columnNames: string[];
	primaryKeys: string[];
	uniqueConstraints: UniqueConstraint[];
}

export interface RowChange {
	table: string;
	pk: Record<string, JsonPrimitive>;
	before: Record<string, JsonValue> | null;
	after: Record<string, JsonValue> | null;
}

export interface MutationPlan {
	id: string;
	description: string;
	changes: readonly RowChange[];
	createdAt: number;
}
