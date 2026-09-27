/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { sql } from "@kysely/kysely";
import { type AsyncResult, err, ok } from "@kuristina/core";
import { Errors, type SqlError } from "../errors.ts";
import { Repository } from "./helper.ts";

export interface MarkovLink {
	prefix: string;
	suffix: string;
	count: number;
}

export interface MarkovChainRow extends MarkovLink {
	id: number;
}

export interface MarkovWordRow {
	word: string;
	count: number;
}

const LINK_COLUMNS = ["prefix", "suffix", "count"] as const;

export class MarkovRepository extends Repository {
	learnWord(word: string): AsyncResult<void, SqlError> {
		return this.mutate("learnWord", (db) =>
			db.insertInto("markov_words")
				.values({ word, count: 1 })
				.onConflict((oc) => oc.column("word").doUpdateSet((eb) => ({ count: eb("count", "+", 1) })))
				.execute());
	}

	bulkLearnChain(entries: readonly MarkovLink[]): AsyncResult<void, SqlError> {
		if (!entries.length) return Promise.resolve(ok(undefined));

		return this.transaction("bulkLearnChain", async (trx) => {
			for (const { prefix, suffix, count } of entries) {
				await trx.insertInto("markov_chain")
					.values({ prefix, suffix, count })
					.onConflict((oc) =>
						oc.columns(["prefix", "suffix"]).doUpdateSet((eb) => ({
							count: eb("count", "+", count),
						}))
					)
					.execute();
			}
		});
	}

	async sampleWord(): AsyncResult<string, SqlError> {
		const sampled = await this.attempt("sampleWord", async (db) => {
			const total = await db.selectFrom("markov_words")
				.select(({ fn }) => fn.sum<number>("count").as("total"))
				.executeTakeFirst();

			if (!total?.total) return null;

			const threshold = Math.floor(Math.random() * total.total);
			const row = await db.selectFrom("markov_words")
				.select("word")
				.where(({ eb, selectFrom }) =>
					eb(
						selectFrom("markov_words as m2")
							.select(({ fn }) => fn.sum<number>("count").as("cum"))
							.whereRef("m2.word", "<=", "markov_words.word"),
						">",
						threshold,
					)
				)
				.orderBy("word")
				.limit(1)
				.executeTakeFirst();

			return row?.word ?? null;
		});

		if (!sampled.ok) return sampled;
		if (!sampled.value) return err(Errors.queryFailed("sampleWord()", "12 reais :("));
		return ok(sampled.value);
	}

	findLinksByPrefix(prefix: string): AsyncResult<MarkovLink[], SqlError> {
		return this.attempt(
			"findLinksByPrefix",
			(db) =>
				db.selectFrom("markov_chain").select(LINK_COLUMNS)
					.where("prefix", "=", prefix).execute(),
		);
	}

	findRandomSeedContaining(word: string): AsyncResult<MarkovLink[], SqlError> {
		return this.attempt("findRandomSeedContaining", async (db) => {
			const matches = await sql<{ id: number }>`
				SELECT rowid as id FROM markov_chain_fts
				WHERE markov_chain_fts MATCH ${word + "*"}
				ORDER BY RANDOM() LIMIT 1
			`.execute(db);

			const id = matches.rows[0]?.id;
			if (!id) return [];

			return await db.selectFrom("markov_chain")
				.select(LINK_COLUMNS)
				.where("id", "=", id)
				.execute();
		});
	}

	maxChainId(): AsyncResult<number | null, SqlError> {
		return this.attempt("maxChainId", async (db) => {
			const row = await db.selectFrom("markov_chain")
				.select(({ fn }) => fn.max("id").as("id")).executeTakeFirst();
			return row?.id ?? null;
		});
	}

	findChainFromId(id: number): AsyncResult<MarkovLink[], SqlError> {
		return this.attempt(
			"findChainFromId",
			(db) =>
				db.selectFrom("markov_chain").select(LINK_COLUMNS)
					.where("id", ">=", id).limit(1).execute(),
		);
	}

	findMatching(pattern: string): AsyncResult<
		{ chain: MarkovChainRow[]; words: MarkovWordRow[] },
		SqlError
	> {
		const like = `%${pattern}%`;

		return this.attempt("findMatching", async (db) => {
			const [chain, words] = await Promise.all([
				db.selectFrom("markov_chain")
					.select(["id", ...LINK_COLUMNS])
					.where((eb) => eb.or([eb("prefix", "like", like), eb("suffix", "like", like)]))
					.execute(),
				db.selectFrom("markov_words")
					.select(["word", "count"])
					.where("word", "like", like)
					.execute(),
			]);

			return { chain, words };
		});
	}

	findNoise(minCount: number): AsyncResult<MarkovChainRow[], SqlError> {
		return this.attempt("findNoise", (db) =>
			db.selectFrom("markov_chain")
				.select(["id", ...LINK_COLUMNS])
				.where("count", "<=", minCount)
				.execute());
	}

	forget(pattern: string): AsyncResult<number, SqlError> {
		const like = `%${pattern}%`;

		return this.transaction("forget", async (trx) => {
			const chain = await trx.deleteFrom("markov_chain")
				.where((eb) => eb.or([eb("prefix", "like", like), eb("suffix", "like", like)]))
				.executeTakeFirst();
			const words = await trx.deleteFrom("markov_words")
				.where("word", "like", like)
				.executeTakeFirst();

			return Number(chain.numDeletedRows ?? 0n) + Number(words.numDeletedRows ?? 0n);
		});
	}

	pruneNoise(minCount: number): AsyncResult<number, SqlError> {
		return this.affected(
			"pruneNoise",
			(db) => db.deleteFrom("markov_chain").where("count", "<=", minCount).executeTakeFirst(),
		);
	}
}
