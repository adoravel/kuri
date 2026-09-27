/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { AsyncResult } from "@kuristina/core";
import type { SqlError } from "../errors.ts";
import { Repository } from "./helper.ts";

export class StateRepository extends Repository {
	get(key: string): AsyncResult<string | null, SqlError> {
		return this.attempt("get", async (db) => {
			const row = await db.selectFrom("bot_state")
				.select("value").where("key", "=", key).executeTakeFirst();
			return row?.value ?? null;
		});
	}

	set(key: string, value: string): AsyncResult<void, SqlError> {
		return this.mutate("set", (db) =>
			db.insertInto("bot_state")
				.values({ key, value })
				.onConflict((oc) =>
					oc.column("key").doUpdateSet((eb) => ({ value: eb.ref("excluded.value") }))
				)
				.execute());
	}

	delete(key: string): AsyncResult<void, SqlError> {
		return this.mutate(
			"delete",
			(db) => db.deleteFrom("bot_state").where("key", "=", key).execute(),
		);
	}
}
