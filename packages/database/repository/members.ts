/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { AsyncResult } from "@kuristina/core";
import type { SqlError } from "../errors.ts";
import { Repository } from "./helper.ts";

export class GuildMemberRepository extends Repository {
	setPresent(discordId: bigint, guildId: bigint): AsyncResult<void, SqlError> {
		return this.mutate("setPresent", (db) =>
			db.insertInto("guild_members")
				.values({
					discord_id: discordId.toString(),
					guild_id: guildId.toString(),
					joined_at: Math.floor(Date.now() / 1000),
				})
				.onConflict((oc) => oc.columns(["discord_id", "guild_id"]).doNothing())
				.execute());
	}

	setAbsent(discordId: bigint, guildId: bigint): AsyncResult<void, SqlError> {
		return this.mutate("setAbsent", (db) =>
			db.deleteFrom("guild_members")
				.where("discord_id", "=", discordId.toString())
				.where("guild_id", "=", guildId.toString())
				.execute());
	}

	reconcileGuild(
		guildId: bigint,
		memberIds: ReadonlySet<bigint>,
	): AsyncResult<{ added: number; removed: number }, SqlError> {
		const guild = guildId.toString();

		return this.transaction("reconcileGuild", async (trx) => {
			const existingRows = await trx.selectFrom("guild_members")
				.select("discord_id")
				.where("guild_id", "=", guild)
				.execute();

			const existing = new Set(existingRows.map((r) => r.discord_id));
			const toAdd = [...memberIds].map(String).filter((id) => !existing.has(id));
			const toRemove = [...existing].filter((id) => !memberIds.has(BigInt(id)));

			if (toAdd.length) {
				const now = Math.floor(Date.now() / 1000);
				await trx.insertInto("guild_members")
					.values(toAdd.map((id) => ({ discord_id: id, guild_id: guild, joined_at: now })))
					.onConflict((oc) => oc.columns(["discord_id", "guild_id"]).doNothing())
					.execute();
			}

			if (toRemove.length) {
				await trx.deleteFrom("guild_members")
					.where("guild_id", "=", guild)
					.where("discord_id", "in", toRemove)
					.execute();
			}

			return { added: toAdd.length, removed: toRemove.length };
		});
	}
}
