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

export function createForgejoService(cache: CacheStore) {
	return {
		fetchSnippet,
		fetchRepoMeta: (instance: string, owner: string, repo: string) =>
			fetchRepoMeta(cache, instance, owner, repo),
		extractBlobRefs,
	};
}
export type ForgejoService = ReturnType<typeof createForgejoService>;
