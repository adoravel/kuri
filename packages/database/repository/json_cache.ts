/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { AsyncResult, CacheStore } from "@kuristina/core";
import type { SqlError } from "../errors.ts";
import type { Database } from "../connection.ts";
import { Repository } from "./helper.ts";

export type JsonCacheTable = "external_cache" | "lastfm_response_cache";

const seconds = () => Math.floor(Date.now() / 1000);

export class JsonCacheRepository extends Repository {
	constructor(db: Database, private readonly table: JsonCacheTable) {
		super(db);
	}

	get<T>(key: string, ttlSeconds: number): AsyncResult<T | null, SqlError> {
		return this.attempt("get", async (db) => {
			const row = await db.selectFrom(this.table)
				.select(["payload", "cached_at"])
				.where("cache_key", "=", key)
				.executeTakeFirst();

			if (!row || seconds() - row.cached_at > ttlSeconds) return null;
			return JSON.parse(row.payload) as T;
		});
	}

	set<T>(key: string, value: T): AsyncResult<void, SqlError> {
		return this.mutate("set", (db) =>
			db.insertInto(this.table)
				.values({ cache_key: key, payload: JSON.stringify(value), cached_at: seconds() })
				.onConflict((oc) =>
					oc.column("cache_key").doUpdateSet((eb) => ({
						payload: eb.ref("excluded.payload"),
						cached_at: eb.ref("excluded.cached_at"),
					}))
				)
				.execute());
	}

	delete(key: string): AsyncResult<void, SqlError> {
		return this.mutate(
			"delete",
			(db) => db.deleteFrom(this.table).where("cache_key", "=", key).execute(),
		);
	}

	deleteWhereKeyContains(fragment: string): AsyncResult<number, SqlError> {
		return this.affected("deleteWhereKeyContains", (db) =>
			db.deleteFrom(this.table)
				.where("cache_key", "like", `%${fragment}%`)
				.executeTakeFirst());
	}

	purgeExpired(ttlSeconds: number): AsyncResult<number, SqlError> {
		return this.affected("purgeExpired", (db) =>
			db.deleteFrom(this.table)
				.where("cached_at", "<", seconds() - ttlSeconds)
				.executeTakeFirst());
	}
}

export function toCacheStore(repository: JsonCacheRepository): CacheStore {
	const warn = (op: string, error: SqlError) => logger.warn(`cache: ${op} failed:`, error);

	return {
		async get<T>(key: string, ttlSeconds: number) {
			const result = await repository.get<T>(key, ttlSeconds);
			if (!result.ok) {
				warn("get", result.error);
				return null;
			}
			return result.value;
		},
		async set(key, value) {
			const result = await repository.set(key, value);
			if (!result.ok) warn("set", result.error);
		},
		async delete(key) {
			const result = await repository.delete(key);
			if (!result.ok) warn("delete", result.error);
		},
		async deleteWhereKeyContains(fragment) {
			const result = await repository.deleteWhereKeyContains(fragment);
			if (!result.ok) warn("deleteWhereKeyContains", result.error);
		},
	};
}
