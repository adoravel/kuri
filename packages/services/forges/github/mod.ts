/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CacheStore } from "@kuristina/core";
import { extractBlobRefs } from "./extractor.ts";
import { fetchRepoMeta, fetchSnippet } from "./http.ts";

export * from "./types.ts";
export * from "./extractor.ts";
export * from "./http.ts";

export function createGitHubService(cache: CacheStore) {
	return {
		fetchSnippet,
		fetchRepoMeta: (owner: string, repo: string) => fetchRepoMeta(cache, owner, repo),
		extractBlobRefs,
	};
}
export type GitHubService = ReturnType<typeof createGitHubService>;
