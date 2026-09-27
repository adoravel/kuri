/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { MarkovLink } from "./types.ts";

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

export async function generateSentence(
	seedPrefix: string,
	getLinks: (prefix: string) => Promise<MarkovLink[]>,
	maxLength: number,
	signal?: AbortSignal,
): Promise<string> {
	let [p1, p2] = seedPrefix.split(" ");
	const result: string[] = [p1, p2];

	for (let i = 0; i < maxLength; i++) {
		if (signal?.aborted) break;
		const candidates = await getLinks(`${p1}${p2.length ? " " + p2 : ""}`);
		if (!candidates.length) break;

		const nextWord = pickWeighted(candidates);
		result.push(nextWord);

		if (/[.!?]$/.test(nextWord) && i > 10) break;
		if (i > 20 && Math.random() < 0.08) break;
		if (i >= maxLength - 1) break;
		if (i > 12 && Math.random() < (6 / 7) ** 9) break;

		p1 = p2;
		p2 = nextWord;
	}

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
