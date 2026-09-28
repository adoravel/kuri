/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { MarkovLink } from "./types.ts";

export type Lookahead = (from: string[], steps: number) => Promise<string[]>;

export interface WalkHooks {
	pick?: (soFar: string[], links: MarkovLink[], lookahead: Lookahead) => Promise<string[]>;

	active?: () => boolean;
}

export function sanitise(text: string): string {
	return text.replace(/`{1,3}[\s\S]*?`{1,3}/g, "").trim();
}

export function tokenize(text: string): string[] {
	return text.split(/\s+/).filter(Boolean);
}

export function pickWeighted(items: MarkovLink[]): string {
	const totalWeight = items.reduce((sum, item) => sum + item.count, 0);
	let random = Math.random() * totalWeight;

	for (const link of items) {
		if (random < link.count) {
			return link.suffix;
		}
		random -= link.count;
	}

	return items[0]?.suffix ?? "";
}

export function buildChain(tokens: string[]): { prefix: string; suffix: string }[] {
	if (tokens.length < 2) return [];
	const chain = [];
	for (let i = 0; i < tokens.length - 2; i++) {
		chain.push({
			prefix: `${tokens[i]} ${tokens[i + 1]}`,
			suffix: tokens[i + 2],
		});
	}
	return chain;
}

export function keywords(text: string, max = 4): string[] {
	const words = tokenize(sanitise(text))
		.filter((w) => !/^(https?:\/\/|<[@#:]|<a:)/i.test(w))
		.map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase())
		.filter((w) => w.length >= 4);

	const unique = [...new Set(words)];
	for (let i = unique.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[unique[i], unique[j]] = [unique[j], unique[i]];
	}
	return unique.slice(0, max);
}

export async function generateSentence(
	seedPrefix: string,
	getLinks: (prefix: string) => Promise<MarkovLink[]>,
	maxLength: number,
	signal?: AbortSignal,
	hooks?: WalkHooks,
): Promise<string> {
	let [p1, p2] = seedPrefix.split(" ");
	const result: string[] = [p1, p2];

	const lookahead: Lookahead = async (from, steps) => {
		const path: string[] = [];
		let a = from[from.length - 2] ?? "";
		let b = from[from.length - 1] ?? "";
		for (let s = 0; s < steps; s++) {
			const links = await getLinks(`${a} ${b}`);
			if (!links.length) break;
			const w = pickWeighted(links);
			path.push(w);
			if (/[.!?]$/.test(w)) break;
			a = b;
			b = w;
		}
		return path;
	};

	let generated = 0;
	while (generated < maxLength) {
		if (signal?.aborted) break;
		const candidates = await getLinks(`${p1}${p2.length ? " " + p2 : ""}`);
		if (!candidates.length) break;

		const words = hooks?.pick
			? await hooks.pick(result, candidates, lookahead)
			: [pickWeighted(candidates)];
		if (!words.length) break;

		result.push(...words);
		generated += words.length;
		const i = generated - 1;
		p1 = result[result.length - 2];
		p2 = result[result.length - 1];

		if (/[.!?]$/.test(p2) && i > 10) break;
		if (generated >= maxLength) break;

		if (!hooks?.active?.()) {
			if (i > 20 && Math.random() < 0.08) break;
			if (i > 12 && Math.random() < (6 / 7) ** 9) break;
		}
	}

	result.splice(maxLength + 2);
	const firstUrl = result.findIndex((w) => /https?:\/\/\S+/.test(w));
	return firstUrl === -1 ? result.join(" ") : result.slice(0, firstUrl + 1).join(" ");
}

export function shouldLearn(text: string): boolean {
	const tokens = tokenize(sanitise(text));
	if (tokens.length < 2) return false;

	// Skip very short messages unless they contain a url
	if (tokens.length <= 2 && !/https?:\/\/\S+/.test(text)) return false;
	return true;
}
