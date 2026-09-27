/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type AsyncResult, type CacheStore, ok, tap } from "@kuristina/core";
import type { LastFmError } from "./errors.ts";

export type CacheKind = "metadata" | "user_stats" | "recent_tracks";

const TTL_SECONDS: Record<CacheKind, number> = {
	metadata: 24 * 3600,
	user_stats: 15 * 60,
	recent_tracks: 60,
};

const cacheKey = (method: string, params: Record<string, unknown>): string => {
	const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
	return `${method}:${sorted}`;
};

export interface LastFmCache {
	through<T>(
		kind: CacheKind,
		method: string,
		params: Record<string, unknown>,
		fetcher: () => AsyncResult<T, LastFmError>,
	): AsyncResult<T, LastFmError>;
	invalidate(method: string, params: Record<string, unknown>): Promise<void>;
	invalidateForUser(username: string): Promise<void>;
}

export function createLastFmCache(store: CacheStore): LastFmCache {
	return {
		async through(kind, method, params, fetcher) {
			const key = cacheKey(method, params);

			const cached = await store.get<never>(key, TTL_SECONDS[kind]);
			if (cached !== null) return ok(cached);

			return tap(await fetcher())(($) => store.set(key, $));
		},
		invalidate: (method, params) => store.delete(cacheKey(method, params)),
		invalidateForUser: (username) => store.deleteWhereKeyContains(username),
	};
}
