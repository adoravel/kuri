/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type AsyncResult, err, ok } from "@kuristina/core";
import type { Database, Executor } from "../connection.ts";
import type { SqlError } from "../errors.ts";
import { assertEditableTable } from "./guard.ts";
import { coerceValue, tableMetadataFor } from "./metadata.ts";
import type { JsonValue, MutationPlan, RowChange, TableMetadata } from "./types.ts";

export type ValidationError = { kind: "validation"; message: string };
export type EditError = SqlError | ValidationError;

export const isEditError = (e: unknown): e is EditError =>
	typeof e === "object" && e !== null && "kind" in e &&
	((e as { kind: unknown }).kind === "validation" || (e as { kind: unknown }).kind === "sql");

const invalid = (message: string): ValidationError => ({ kind: "validation", message });

interface GroupedOps {
	inserts: Record<string, JsonValue>[];
	updates: { pk: Record<string, JsonValue>; data: Record<string, JsonValue> }[];
	deletes: Record<string, JsonValue>[];
}

function groupChanges(changes: readonly RowChange[]): Map<string, GroupedOps> {
	const groups = new Map<string, GroupedOps>();

	for (const change of changes) {
		let entry = groups.get(change.table);
		if (!entry) groups.set(change.table, entry = { inserts: [], updates: [], deletes: [] });

		if (change.after === null) entry.deletes.push(change.pk);
		else if (change.before === null) entry.inserts.push(change.after);
		else entry.updates.push({ pk: change.pk, data: change.after });
	}

	return groups;
}

const describePk = (pk: Record<string, JsonValue>) =>
	Object.entries(pk).map(([k, v]) => `${k}=${v}`).join(" ");

function identifyingConditions(
	pk: Record<string, JsonValue>,
	metadata: TableMetadata,
): Record<string, JsonValue> {
	const byPrimaryKey = Object.fromEntries(
		Object.entries(pk).filter(([k]) => metadata.primaryKeys.includes(k)),
	);
	if (Object.keys(byPrimaryKey).length === metadata.primaryKeys.length) return byPrimaryKey;

	for (const constraint of metadata.uniqueConstraints) {
		const matched = Object.fromEntries(
			Object.entries(pk).filter(([k]) => constraint.columns.includes(k)),
		);
		if (Object.keys(matched).length === constraint.columns.length) return matched;
	}

	if (Object.keys(byPrimaryKey).length) return byPrimaryKey;
	throw invalid("No primary key or unique constraint conditions provided");
}

function coerceRow(
	data: Record<string, JsonValue>,
	metadata: TableMetadata,
	skip: readonly string[] = [],
): Record<string, JsonValue> {
	return Object.fromEntries(
		metadata.columns
			.filter((column) => column.name in data && !skip.includes(column.name))
			.map((column) => [column.name, coerceValue(data[column.name], column)]),
	);
}

function whereAll<Q extends { where(column: never, op: "=", value: never): Q }>(
	query: Q,
	conditions: Record<string, JsonValue>,
): Q {
	let result = query;
	for (const [column, value] of Object.entries(conditions)) {
		result = result.where(column as never, "=", value as never);
	}
	return result;
}

async function executeDeletes(
	db: Executor,
	metadata: TableMetadata,
	pks: readonly Record<string, JsonValue>[],
): Promise<number> {
	if (!pks.length) return 0;
	logger.warn(`admin: deleting ${pks.length} rows from ${metadata.name}`);

	for (const pk of pks) {
		const conditions = identifyingConditions(pk, metadata);
		const result = await whereAll(
			db.deleteFrom(metadata.name as never),
			conditions,
		).executeTakeFirst();

		const affected = Number(result.numDeletedRows ?? 0);
		if (affected !== 1) {
			throw invalid(
				`expected to delete exactly 1 row in ${metadata.name} (${describePk(pk)}), ` +
					`affected ${affected}. the row may have already been removed`,
			);
		}
	}

	return pks.length;
}

async function executeUpdates(
	db: Executor,
	metadata: TableMetadata,
	updates: readonly { pk: Record<string, JsonValue>; data: Record<string, JsonValue> }[],
): Promise<number> {
	if (!updates.length) return 0;
	logger.info(`admin: updating ${updates.length} rows in ${metadata.name}`);

	for (const { pk, data } of updates) {
		const conditions = identifyingConditions(pk, metadata);
		const values = coerceRow(data, metadata, metadata.primaryKeys);
		if (!Object.keys(values).length) throw invalid("No updatable columns provided");

		const query = db.updateTable(metadata.name as never).set(values as never);
		const result = await whereAll(query, conditions).executeTakeFirst();

		const affected = Number(result.numUpdatedRows ?? 0);
		if (affected !== 1) {
			throw invalid(
				`expected to update exactly 1 row in ${metadata.name} (${describePk(pk)}), ` +
					`affected ${affected}. the row may have changed since this was previewed`,
			);
		}
	}

	return updates.length;
}

async function executeInserts(
	db: Executor,
	metadata: TableMetadata,
	rows: readonly Record<string, JsonValue>[],
): Promise<number> {
	if (!rows.length) return 0;
	logger.info(`admin: inserting ${rows.length} rows into ${metadata.name}`);

	await db.insertInto(metadata.name as never)
		.values(rows.map((row) => coerceRow(row, metadata)) as never)
		.execute();

	return rows.length;
}

export async function applyPlan(db: Database, plan: MutationPlan): AsyncResult<void, EditError> {
	const start = performance.now();
	logger.info(`admin: applying plan "${plan.description}" (${plan.changes.length} changes)`);

	try {
		const groups = groupChanges(plan.changes);
		for (const table of groups.keys()) assertEditableTable(table);

		const metadata = await tableMetadataFor(db, groups.keys());

		await db.transaction().execute(async (trx) => {
			for (const [table, ops] of groups) {
				const meta = metadata.get(table)!;
				const deleted = await executeDeletes(trx, meta, ops.deletes);
				const updated = await executeUpdates(trx, meta, ops.updates);
				const inserted = await executeInserts(trx, meta, ops.inserts);
				logger.yay(
					`admin: ${table} done (${inserted} inserted, ${updated} updated, ${deleted} deleted)`,
				);
			}
		});

		logger.yay(`admin: plan applied in ${(performance.now() - start).toFixed(2)}ms`);
		return ok(undefined);
	} catch (e) {
		logger.boo(
			`admin: plan failed after ${(performance.now() - start).toFixed(2)}ms, rolled back:`,
			e,
		);
		return err(isEditError(e) ? e : invalid(e instanceof Error ? e.message : String(e)));
	}
}
