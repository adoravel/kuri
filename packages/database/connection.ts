/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Kysely, SqliteDialect, type Transaction } from "@kysely/kysely";
import { type AsyncResult, err, ok } from "@kuristina/core";
import { Errors, type SqlError } from "./errors.ts";
import { dirname, join } from "@std/path";
import type { KuristinaSchema } from "./schema.ts";
import { migrate } from "./migrations/mod.ts";
import SQLite from "better-sqlite3";

export type Database = Kysely<KuristinaSchema>;

export type Executor = Database | Transaction<KuristinaSchema>;

const PRAGMAS = [
	"pragma journal_mode = WAL",
	"pragma synchronous = NORMAL",
	"pragma foreign_keys = ON",
	"pragma busy_timeout = 5000",
	"pragma temp_store = MEMORY",
];

function expandHome(path: string): string {
	if (!path.startsWith("~/") && path !== "~") return path;
	const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
	return join(home, path.slice(1));
}

export function createDatabase(path: string): Database {
	const expanded = expandHome(path);
	Deno.mkdirSync(dirname(expanded), { recursive: true });

	const sql = new SQLite(expanded);
	for (const pragma of PRAGMAS) sql.exec(pragma);

	return new Kysely({
		dialect: new SqliteDialect({
			database: sql,
		}),
	});
}

export function initDatabase(db: Database): AsyncResult<void, SqlError> {
	return migrate(db);
}

export function closeDatabase(db: Database): Promise<void> {
	return db.destroy();
}

export async function tryQuery<T>(fn: () => Promise<T>): AsyncResult<T, SqlError> {
	try {
		return ok(await fn());
	} catch (e) {
		return err(Errors.queryFailed(fn.toString(), String(e)));
	}
}
