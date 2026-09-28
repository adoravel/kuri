/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { log } from "./consumer.ts";
import { type Lookahead, pickWeighted, type WalkHooks } from "./core.ts";
import type { GuideConfig, MarkovLink } from "./types.ts";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";

const SKIP_SHARE = 0.85;
const MIN_STOP_WORDS = 6;
const STOP_THRESHOLD = 0.8;

type Answers = Record<
	string,
	{ noul?: number; choice?: string; probabilities?: Record<string, number> }
>;

export interface GuideContext {
	/** the message being answered. */
	incoming: string;
	/** reply chain leading to `incoming`, oldest first */
	thread: string[];
	/** other recent channel messages, oldest first */
	nearby: string[];
}

const CONVERSATION =
	" The state is a chat: `thread` is the chain of replies leading to `incoming` (oldest first), `nearby` is other recent messages, and `draft` is the reply being written.";

export interface Guide {
	hooks: WalkHooks;

	pickSeed(seeds: string[]): Promise<string>;
}

function sampleByCount(counts: Map<string, number>, k: number): [string, number][] {
	const pool = [...counts];
	if (pool.length <= k) return pool;

	const out: [string, number][] = [];
	while (out.length < k) {
		const total = pool.reduce((s, [, c]) => s + c, 0);
		let r = Math.random() * total;
		let idx = 0;
		for (; idx < pool.length - 1; idx++) {
			if (r < pool[idx][1]) break;
			r -= pool[idx][1];
		}
		out.push(pool.splice(idx, 1)[0]);
	}
	return out;
}

function sampleByWeight(weights: number[]): number {
	const total = weights.reduce((a, b) => a + b, 0);
	let r = Math.random() * total;
	for (let i = 0; i < weights.length; i++) {
		if (r < weights[i]) return i;
		r -= weights[i];
	}
	return weights.length - 1;
}

export function createGuide(
	apiKey: string,
	ctx: GuideContext,
	config: GuideConfig,
	signal?: AbortSignal,
): Guide {
	const timeout = AbortSignal.timeout(config.timeoutMs);
	const sig = signal ? AbortSignal.any([signal, timeout]) : timeout;
	const baseState: Record<string, unknown> = { incoming: ctx.incoming.slice(0, 500) };
	if (ctx.thread.length) baseState.thread = ctx.thread;
	if (ctx.nearby.length) baseState.nearby = ctx.nearby;

	let calls = 0;
	const exhausted = () => !apiKey || calls >= config.maxCalls || sig.aborted;

	async function ask(
		draft: string,
		questions: Record<string, unknown>,
	): Promise<Answers | undefined> {
		if (exhausted()) return undefined;
		log(`jev ${calls}++`);
		calls++;

		try {
			const res = await fetch(ENDPOINT, {
				method: "POST",
				signal: sig,
				headers: {
					"Authorization": `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: MODEL,
					state: { ...baseState, draft },
					questions,
				}),
			});
			if (!res.ok) {
				log(`jev http ${res.status}`);
				await res.body?.cancel();
				return undefined;
			}
			return (await res.json()).answers;
		} catch (e) {
			log("jev failed: " + e);
			return undefined;
		}
	}

	const pick = async (
		soFar: string[],
		links: MarkovLink[],
		lookahead: Lookahead,
	): Promise<string[]> => {
		const merged = new Map<string, number>();
		for (const l of links) merged.set(l.suffix, (merged.get(l.suffix) ?? 0) + l.count);

		const total = [...merged.values()].reduce((a, b) => a + b, 0);
		if (merged.size < 2 || Math.max(...merged.values()) / total >= SKIP_SHARE) {
			return [pickWeighted(links)];
		}

		const raw = await Promise.all(
			sampleByCount(merged, config.optionsPerStep).map(async ([word]) => [
				word,
				...(await lookahead([...soFar, word], config.chunkSize - 1)),
			]),
		);
		const seen = new Set<string>();
		const options = raw.filter((o) => !seen.has(o.join(" ")) && seen.add(o.join(" ")));
		if (options.length < 2) return options[0] ?? [pickWeighted(links)];

		const criteria = Object.fromEntries(
			options.map((o, i) => [`o${i}`, `The next words are ${JSON.stringify(o.join(" "))}.`]),
		);

		const questions: Record<string, unknown> = {
			next: {
				type: "choice",
				instructions:
					"Which continuation would make this chat message funnier while staying perfectly understandable? Informal, sloppy or absurd wording is fine as long as the meaning is clear; ideally it riffs on the incoming message and fits the conversation." +
					CONVERSATION,
				criteria,
			},
		};
		if (soFar.length >= MIN_STOP_WORDS) {
			questions.complete = {
				type: "noul",
				instructions:
					"Is the draft already a funny, perfectly understandable message where adding more words would only weaken it?" +
					CONVERSATION,
			};
		}

		const answers = await ask(soFar.join(" "), questions);
		if (!answers) return [pickWeighted(links)];

		const finished = answers.complete?.noul;
		if (typeof finished === "number" && finished >= STOP_THRESHOLD) return [];

		const probs = answers.next?.probabilities;
		if (!probs) return [pickWeighted(links)];

		const weights = options.map((_, i) => (probs[`o${i}`] ?? 0) ** config.sharpness);
		if (weights.every((w) => w <= 0)) return [pickWeighted(links)];

		return options[sampleByWeight(weights)];
	};

	const pickSeed = async (seeds: string[]): Promise<string> => {
		if (seeds.length < 2) return seeds[0];

		const options = seeds.slice(0, 8);
		const criteria = Object.fromEntries(
			options.map((s, i) => [`o${i}`, `The message opens with ${JSON.stringify(s)}.`]),
		);
		const answers = await ask("", {
			opening: {
				type: "choice",
				instructions:
					"Which opening would start the funniest, still perfectly understandable reply to the incoming message, given the conversation?" +
					CONVERSATION,
				criteria,
			},
		});

		const probs = answers?.opening?.probabilities;
		if (!probs) return options[Math.floor(Math.random() * options.length)];

		let best = 0;
		for (let i = 1; i < options.length; i++) {
			if ((probs[`o${i}`] ?? 0) > (probs[`o${best}`] ?? 0)) best = i;
		}
		return options[best];
	};

	return { hooks: { pick, active: () => !exhausted() }, pickSeed };
}
