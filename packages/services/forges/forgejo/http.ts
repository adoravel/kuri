/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { fetchWithRetry, ok } from "@kuristina/core";
import { config } from "@kuristina/config";
import type { Result } from "@kuristina/core";
import type { CacheStore, NetworkError } from "@kuristina/core";
import { fetchLineRangeSnippet, type Snippet } from "../code-forge/snippet.ts";
import type { ForgejoBlobRef } from "./types.ts";
import type { ForgeRepoMeta } from "../code-forge/types.ts";

export async function fetchSnippet(
	ref: ForgejoBlobRef,
): Promise<Result<Snippet, NetworkError>> {
	const url =
		`https://${ref.instance}/${ref.owner}/${ref.repo}/raw/${ref.refKind}/${ref.ref}/${ref.path}`;
	return await fetchLineRangeSnippet(url, ref, ref.instance);
}

const REPO_META_TTL_SECONDS = 3 * 60 * 60;

export async function fetchRepoMeta(
	cache: CacheStore,
	instance: string,
	owner: string,
	repo: string,
): Promise<Result<ForgeRepoMeta, NetworkError>> {
	const cacheKey = `forgejo-repo-meta:${instance}:${owner}/${repo}`;
	const cached = await cache.get<ForgeRepoMeta>(cacheKey, REPO_META_TTL_SECONDS);
	if (cached) return ok(cached);

	const url = `https://${instance}/api/v1/repos/${owner}/${repo}`;
	const result = await fetchWithRetry<{
		description?: string;
		stars_count?: number;
		language?: string;
		owner?: { avatar_url?: string };
	}>(url, {
		headers: { "User-Agent": config.network.userAgent },
		retry: { maxAttempts: 2, baseDelayMs: 500 },
	});
	if (!result.ok) return result;

	const meta: ForgeRepoMeta = {
		description: result.value.description || undefined,
		stars: result.value.stars_count ?? 0,
		language: result.value.language || undefined,
		avatarUrl: result.value.owner?.avatar_url,
	};
	await cache.set(cacheKey, meta);
	return ok(meta);
}
