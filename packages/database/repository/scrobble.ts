/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type AsyncResult, ok } from "@kuristina/core";
import type { SqlError } from "../errors.ts";
import { Repository } from "./helper.ts";

export type ScrobbleProviderName = "last.fm";

export interface ScrobbleAccount {
	provider: ScrobbleProviderName;
	username: string;
	isDefault: boolean;
}

const toUsernameMap = (rows: readonly { discord_id: string; username: string }[]) =>
	new Map(rows.map((r) => [BigInt(r.discord_id), r.username]));

export class ScrobbleAccountRepository extends Repository {
	link(
		discordId: bigint,
		provider: ScrobbleProviderName,
		username: string,
		sessionKey?: string,
		makeDefault = true,
	): AsyncResult<void, SqlError> {
		const discord = discordId.toString();

		return this.transaction("link", async (trx) => {
			if (makeDefault) {
				await trx.updateTable("scrobble_accounts")
					.set({ is_default: 0 })
					.where("discord_id", "=", discord)
					.execute();
			}

			await trx.insertInto("scrobble_accounts")
				.values({
					discord_id: discord,
					provider,
					username,
					is_default: makeDefault ? 1 : 0,
					linked_at: Math.floor(Date.now() / 1000),
					session_key: sessionKey,
				})
				.onConflict((oc) =>
					oc.columns(["discord_id", "provider"]).doUpdateSet((eb) => ({
						username: eb.ref("excluded.username"),
						is_default: eb.ref("excluded.is_default"),
						linked_at: eb.ref("excluded.linked_at"),
						session_key: eb.ref("excluded.session_key"),
					}))
				)
				.execute();
		});
	}

	getSessionKey(
		discordId: bigint,
		provider: ScrobbleProviderName,
	): AsyncResult<string | null, SqlError> {
		return this.attempt("getSessionKey", async (db) => {
			const row = await db.selectFrom("scrobble_accounts")
				.select("session_key")
				.where("discord_id", "=", discordId.toString())
				.where("provider", "=", provider)
				.executeTakeFirst();
			return row?.session_key ?? null;
		});
	}

	unlink(discordId: bigint, provider: ScrobbleProviderName): AsyncResult<void, SqlError> {
		return this.mutate("unlink", (db) =>
			db.deleteFrom("scrobble_accounts")
				.where("discord_id", "=", discordId.toString())
				.where("provider", "=", provider)
				.execute());
	}

	getDefault(discordId: bigint): AsyncResult<ScrobbleAccount | null, SqlError> {
		return this.attempt("getDefault", async (db) => {
			const row = await db.selectFrom("scrobble_accounts")
				.select(["provider", "username", "is_default"])
				.where("discord_id", "=", discordId.toString())
				.orderBy("is_default", "desc")
				.limit(1)
				.executeTakeFirst();

			if (!row) return null;
			return {
				provider: row.provider as ScrobbleProviderName,
				username: row.username,
				isDefault: !!row.is_default,
			};
		});
	}

	getUsernamesForMembers(
		discordIds: readonly bigint[],
		provider: ScrobbleProviderName,
	): AsyncResult<Map<bigint, string>, SqlError> {
		if (!discordIds.length) return Promise.resolve(ok(new Map()));

		return this.attempt("getUsernamesForMembers", async (db) => {
			const rows = await db.selectFrom("scrobble_accounts")
				.select(["discord_id", "username"])
				.where("provider", "=", provider)
				.where("discord_id", "in", discordIds.map(String))
				.execute();
			return toUsernameMap(rows);
		});
	}

	getAllForProvider(provider: ScrobbleProviderName): AsyncResult<Map<bigint, string>, SqlError> {
		return this.attempt("getAllForProvider", async (db) => {
			const rows = await db.selectFrom("scrobble_accounts")
				.select(["discord_id", "username"]).where("provider", "=", provider).execute();
			return toUsernameMap(rows);
		});
	}

	getAllForProviderInGuild(
		provider: ScrobbleProviderName,
		guildId: bigint,
	): AsyncResult<Map<bigint, string>, SqlError> {
		return this.attempt("getAllForProviderInGuild", async (db) => {
			const rows = await db.selectFrom("scrobble_accounts")
				.innerJoin("guild_members", "guild_members.discord_id", "scrobble_accounts.discord_id")
				.select(["scrobble_accounts.discord_id", "scrobble_accounts.username"])
				.where("scrobble_accounts.provider", "=", provider)
				.where("guild_members.guild_id", "=", guildId.toString())
				.execute();
			return toUsernameMap(rows);
		});
	}
}
