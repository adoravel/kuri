/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export * from "./types.ts";
export * from "./guard.ts";
export * from "./mappers.ts";
export * from "./client.ts";
export * from "./extractors.ts";
export * from "./twitter.ts";
export * from "./bluesky.ts";

import { fetchBsky } from "./bluesky.ts";
import {
	extractBskyUrls,
	extractTwitterUrls,
	parseBskyUrl,
	parseTwitterUrl,
} from "./extractors.ts";
import { fetchTwitter } from "./twitter.ts";

export function createTwitterService() {
	return { fetch: fetchTwitter, extractUrls: extractTwitterUrls, parseUrl: parseTwitterUrl };
}
export type TwitterService = ReturnType<typeof createTwitterService>;

export function createBlueskyService() {
	return { fetch: fetchBsky, extractUrls: extractBskyUrls, parseUrl: parseBskyUrl };
}
export type BlueskyService = ReturnType<typeof createBlueskyService>;
