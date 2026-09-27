/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Transaction } from "@kysely/kysely";
import { type AsyncResult, discard, err, ok } from "@kuristina/core";
import { Errors, type SqlError } from "../errors.ts";
import type { Database, Executor } from "../connection.ts";
import type { KuristinaSchema } from "../schema.ts";

interface MutationResult {
	readonly numDeletedRows?: bigint;
	readonly numUpdatedRows?: bigint;
}

export abstract class Repository {
	constructor(protected readonly db: Database) {}

	protected async attempt<T>(
		op: string,
		fn: (db: Executor) => Promise<T>,
	): AsyncResult<T, SqlError> {
		try {
			return ok(await fn(this.db));
		} catch (e) {
			return err(Errors.queryFailed(`${this.constructor.name}.${op}`, String(e)));
		}
	}

	protected mutate(
		op: string,
		fn: (db: Executor) => Promise<unknown>,
	): AsyncResult<void, SqlError> {
		return this.attempt(op, fn).then(discard);
	}

	protected affected(
		op: string,
		fn: (db: Executor) => Promise<MutationResult>,
	): AsyncResult<number, SqlError> {
		return this.attempt(op, async (db) => {
			const result = await fn(db);
			return Number(result.numDeletedRows ?? result.numUpdatedRows ?? 0n);
		});
	}

	protected transaction<T>(
		op: string,
		fn: (trx: Transaction<KuristinaSchema>) => Promise<T>,
	): AsyncResult<T, SqlError> {
		return this.attempt(op, () => this.db.transaction().execute(fn));
	}
}
