/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { createBadge, ok, prefixed, type Result } from "@kuristina/core";
import type { SqlError } from "@kuristina/database";
import { TimedMap } from "@kuristina/core";
import { bgYellow, black } from "@std/fmt/colors";

import {
	buildChain,
	generateSentence,
	sanitise,
	shouldLearn,
	tokenize,
	type WalkHooks,
} from "./core.ts";
import type { MarkovLink } from "./types.ts";
import type { Services } from "../services.ts";

const badge = createBadge({ label: "markov", bg: bgYellow, fg: black });

export const log = (msg: string) => prefixed(badge, msg);

export interface MarkovConsumer {
	learn(text: string): Promise<Result<void, SqlError>>;

	bulkLearn(messages: string[]): Promise<Result<void, SqlError>>;

	sampleWord(): Promise<Result<string, SqlError>>;

	generate(bias?: string, signal?: AbortSignal): Promise<Result<string, SqlError>>;

	seedCandidates(words: string[], randomCount: number): Promise<Result<string[], SqlError>>;

	generateFrom(
		seedPrefix: string,
		signal?: AbortSignal,
		hooks?: WalkHooks,
	): Promise<Result<string, SqlError>>;
}

export function createMarkovConsumer(services: Services): MarkovConsumer {
	const { markov } = services.repos;
	const linkCache = new TimedMap<string, MarkovLink[]>(30_000);

	const getLinks = async (prefix: string): Promise<MarkovLink[]> => {
		const cached = linkCache.get(prefix);
		if (cached) return cached;
		const res = await markov.findLinksByPrefix(prefix);
		const value = res.ok ? res.value : [];
		linkCache.set(prefix, value);
		return value;
	};

	async function learn(text: string): Promise<Result<void, SqlError>> {
		if (!shouldLearn(text)) return ok(undefined);

		const tokens = tokenize(sanitise(text));
		if (tokens.length === 1) {
			return await markov.learnWord(tokens[0]);
		}

		const chain = buildChain(tokens);
		if (!chain.length) return ok(undefined);

		const entries = chain.map(({ prefix, suffix }) => ({ prefix, suffix, count: 1 }));
		return await markov.bulkLearnChain(entries);
	}

	async function bulkLearn(messages: string[]): Promise<Result<void, SqlError>> {
		const tallies = new Map<string, Map<string, number>>();
		for (const msg of messages) {
			if (!shouldLearn(msg)) continue;
			const tokens = tokenize(sanitise(msg));
			const chain = buildChain(tokens);
			for (const { prefix, suffix } of chain) {
				const inner = tallies.get(prefix) ?? new Map();
				inner.set(suffix, (inner.get(suffix) ?? 0) + 1);
				tallies.set(prefix, inner);
			}
		}

		const entries = [];
		for (const [prefix, suffixes] of tallies) {
			for (const [suffix, count] of suffixes) {
				entries.push({ prefix, suffix, count });
			}
		}
		return await markov.bulkLearnChain(entries);
	}

	async function sampleWord(): Promise<Result<string, SqlError>> {
		return await markov.sampleWord();
	}

	async function randomSeed(): Promise<Result<string | null, SqlError>> {
		const maxIdRes = await markov.maxChainId();
		if (!maxIdRes.ok) return maxIdRes;
		if (maxIdRes.value === null) return ok(null);

		const randomId = Math.floor(Math.random() * maxIdRes.value) + 1;
		const rows = await markov.findChainFromId(randomId);
		if (!rows.ok) return rows;
		return ok(rows.value.length ? rows.value[0].prefix : null);
	}

	async function seedCandidates(
		words: string[],
		randomCount: number,
	): Promise<Result<string[], SqlError>> {
		const seeds = new Set<string>();

		const found = await Promise.all(words.map((w) => markov.findRandomSeedContaining(w)));
		for (const res of found) {
			if (res.ok) { for (const row of res.value.slice(0, 2)) seeds.add(row.prefix); }
		}

		for (let i = 0; i < randomCount; i++) {
			const r = await randomSeed();
			if (!r.ok) return r;
			if (r.value) seeds.add(r.value);
		}

		return ok([...seeds]);
	}

	async function generateFrom(
		seedPrefix: string,
		signal?: AbortSignal,
		hooks?: WalkHooks,
	): Promise<Result<string, SqlError>> {
		if (signal?.aborted) return ok("");
		const maxLength = services.config.modules.markov.maxGenerationLength;
		return ok(await generateSentence(seedPrefix, getLinks, maxLength, signal, hooks));
	}

	async function generate(
		bias?: string,
		signal?: AbortSignal,
	): Promise<Result<string, SqlError>> {
		let seedPrefix: string | undefined;

		if (bias) {
			const word = bias.trim();
			const result = await markov.findRandomSeedContaining(word);
			if (result.ok && result.value.length) {
				seedPrefix = result.value[0].prefix;
			}
		}

		if (!seedPrefix) {
			const seed = await randomSeed();
			if (!seed.ok) return seed;
			if (seed.value === null) return ok("no data available");
			seedPrefix = seed.value;
		}

		return await generateFrom(seedPrefix, signal);
	}

	return { learn, bulkLearn, sampleWord, generate, seedCandidates, generateFrom };
}
