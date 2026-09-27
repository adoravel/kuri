/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { AsyncResult } from "@kuristina/core";
import type { SqlError } from "../errors.ts";
import { Repository } from "./helper.ts";

export class GuildProfileRepository extends Repository {
	getHash(guildId: bigint): AsyncResult<string | null, SqlError> {
		return this.attempt("getHash", async (db) => {
			const row = await db.selectFrom("guild_profile_syncs")
				.select("params_hash")
				.where("guild_id", "=", guildId.toString())
				.executeTakeFirst();
			return row?.params_hash ?? null;
		});
	}

	setHash(guildId: bigint, hash: string): AsyncResult<void, SqlError> {
		return this.mutate("setHash", (db) =>
			db.insertInto("guild_profile_syncs")
				.values({
					guild_id: guildId.toString(),
					params_hash: hash,
					synced_at: Math.floor(Date.now() / 1000),
				})
				.onConflict((oc) =>
					oc.column("guild_id").doUpdateSet((eb) => ({
						params_hash: eb.ref("excluded.params_hash"),
						synced_at: eb.ref("excluded.synced_at"),
					}))
				)
				.execute());
	}
}
