/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CacheStore } from "@kuristina/core";
import { resolveSongLink, resolveSongLinkByQuery } from "./query.ts";
import { extractMusicUrls, normaliseSongUrl } from "./utils.ts";

export * from "./types.ts";
export * from "./query.ts";
export * from "./utils.ts";

export function createMusicLinksService(cache: CacheStore) {
	return {
		resolve: (url: string) => resolveSongLink(cache, url),
		resolveByQuery: (artist: string, title: string) => resolveSongLinkByQuery(cache, artist, title),
		extractUrls: extractMusicUrls,
		normalise: normaliseSongUrl,
	};
}
export type MusicLinksService = ReturnType<typeof createMusicLinksService>;
