/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type AsyncResult, ok } from "@kuristina/core";
import type { SqlError } from "../errors.ts";
import { Repository } from "./helper.ts";

export type AliasSource = "autocorrect" | "manual";

export interface ArtistAlias {
	nameKey: string;
	displayName: string;
	groupId: number;
	source: AliasSource;
	skipAutocorrect: boolean;
}

const ALIAS_COLUMNS = [
	"name_key",
	"display_name",
	"group_id",
	"source",
	"skip_autocorrect",
] as const;

type AliasRow = {
	name_key: string;
	display_name: string;
	group_id: number;
	source: string;
	skip_autocorrect: number;
};

const toAlias = (row: AliasRow): ArtistAlias => ({
	nameKey: row.name_key,
	displayName: row.display_name,
	groupId: row.group_id,
	source: row.source as AliasSource,
	skipAutocorrect: row.skip_autocorrect === 1,
});

const key = (name: string): string => name.trim().toLowerCase();

export class ArtistAliasRepository extends Repository {
	getGroup(name: string): AsyncResult<string[], SqlError> {
		return this.attempt("getGroup", async (db) => {
			const own = await db.selectFrom("artist_aliases")
				.select("group_id").where("name_key", "=", key(name)).executeTakeFirst();
			if (!own) return [name];

			const members = await db.selectFrom("artist_aliases")
				.select("display_name").where("group_id", "=", own.group_id).execute();
			return members.map((m) => m.display_name);
		});
	}

	getCanonical(name: string): AsyncResult<string, SqlError> {
		return this.attempt("getCanonical", async (db) => {
			const row = await db.selectFrom("artist_aliases")
				.select("group_id")
				.where("name_key", "=", key(name))
				.executeTakeFirst();
			if (!row) return name;

			const canonical = await db.selectFrom("artist_aliases")
				.select("display_name")
				.where("group_id", "=", row.group_id)
				.orderBy("source", "asc")
				.executeTakeFirst();

			return canonical?.display_name ?? name;
		});
	}

	shouldSkipAutocorrect(name: string): AsyncResult<boolean, SqlError> {
		return this.attempt("shouldSkipAutocorrect", async (db) => {
			const row = await db.selectFrom("artist_aliases")
				.select("skip_autocorrect")
				.where("name_key", "=", key(name))
				.executeTakeFirst();
			return row?.skip_autocorrect === 1;
		});
	}

	getAll(): AsyncResult<ArtistAlias[], SqlError> {
		return this.attempt("getAll", async (db) => {
			const rows = await db.selectFrom("artist_aliases")
				.select(ALIAS_COLUMNS)
				.orderBy("display_name")
				.execute();
			return rows.map(toAlias);
		});
	}

	getByGroup(groupId: number): AsyncResult<ArtistAlias[], SqlError> {
		return this.attempt("getByGroup", async (db) => {
			const rows = await db.selectFrom("artist_aliases")
				.select(ALIAS_COLUMNS)
				.where("group_id", "=", groupId)
				.orderBy("display_name")
				.execute();
			return rows.map(toAlias);
		});
	}

	link(
		a: string,
		b: string,
		source: AliasSource,
		skipAutocorrect = false,
	): AsyncResult<void, SqlError> {
		if (key(a) === key(b)) return Promise.resolve(ok(undefined));

		return this.transaction("link", async (trx) => {
			const [rowA, rowB] = await Promise.all([
				trx.selectFrom("artist_aliases").select(["group_id", "skip_autocorrect"])
					.where("name_key", "=", key(a)).executeTakeFirst(),
				trx.selectFrom("artist_aliases").select(["group_id", "skip_autocorrect"])
					.where("name_key", "=", key(b)).executeTakeFirst(),
			]);

			if (rowA && rowB && rowA.group_id === rowB.group_id) {
				if (skipAutocorrect && !rowA.skip_autocorrect) {
					await trx.updateTable("artist_aliases")
						.set({ skip_autocorrect: 1 })
						.where("group_id", "=", rowA.group_id)
						.execute();
				}
				return;
			}

			const skip = skipAutocorrect || rowA?.skip_autocorrect === 1 || rowB?.skip_autocorrect === 1;
			let groupId: number;

			if (rowA) {
				groupId = rowA.group_id;
			} else if (rowB) {
				groupId = rowB.group_id;
			} else {
				const created = await trx.insertInto("artist_alias_groups")
					.values({ created_at: Math.floor(Date.now() / 1000) })
					.executeTakeFirstOrThrow();
				groupId = Number(created.insertId);
			}

			if (rowA && rowB) {
				const loser = groupId === rowA.group_id ? rowB.group_id : rowA.group_id;
				await trx.updateTable("artist_aliases").set({ group_id: groupId })
					.where("group_id", "=", loser).execute();
				await trx.deleteFrom("artist_alias_groups").where("id", "=", loser).execute();
			}

			for (const name of [a, b]) {
				await trx.insertInto("artist_aliases")
					.values({
						name_key: key(name),
						display_name: name,
						group_id: groupId,
						source,
						skip_autocorrect: skip ? 1 : 0,
					})
					.onConflict((oc) =>
						oc.column("name_key").doUpdateSet((eb) => ({
							display_name: eb.ref("excluded.display_name"),
							group_id: eb.ref("excluded.group_id"),
							source: eb.ref("excluded.source"),
							skip_autocorrect: eb.ref("excluded.skip_autocorrect"),
						}))
					)
					.execute();
			}
		});
	}

	setSkipAutocorrect(name: string, skip: boolean): AsyncResult<void, SqlError> {
		return this.transaction("setSkipAutocorrect", async (trx) => {
			const row = await trx.selectFrom("artist_aliases")
				.select("group_id")
				.where("name_key", "=", key(name))
				.executeTakeFirst();

			if (!row) throw new Error(`No alias found for "${name}"`);

			await trx.updateTable("artist_aliases")
				.set({ skip_autocorrect: skip ? 1 : 0 })
				.where("group_id", "=", row.group_id)
				.execute();
		});
	}
}
