/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { config } from "@kuristina/config";
import type { CacheStore, NetworkError, Result } from "@kuristina/core";
import { fetchWithRetry, ok } from "@kuristina/core";
import { fetchLineRangeSnippet, type ForgeRepoMeta, type Snippet } from "../code-forge/mod.ts";
import type { GitHubBlobRef, GitHubSnippet } from "./types.ts";

export async function fetchSnippet(
	ref: GitHubBlobRef,
): Promise<Result<GitHubSnippet, NetworkError>> {
	const url = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${ref.ref}/${ref.path}`;
	return await fetchLineRangeSnippet(url, ref, "GitHub") as Result<Snippet, NetworkError>;
}

const REPO_META_TTL_SECONDS = 3 * 60 * 60;

export async function fetchRepoMeta(
	cache: CacheStore,
	owner: string,
	repo: string,
): Promise<Result<ForgeRepoMeta, NetworkError>> {
	const cacheKey = `github-repo-meta:${owner}/${repo}`;
	const cached = await cache.get<ForgeRepoMeta>(cacheKey, REPO_META_TTL_SECONDS);
	if (cached) return ok(cached);

	const url = `https://api.github.com/repos/${owner}/${repo}`;
	const result = await fetchWithRetry<{
		description?: string;
		stargazers_count?: number;
		language?: string;
		owner?: { avatar_url?: string };
	}>(url, {
		headers: {
			"User-Agent": config.network.userAgent,
			Accept: "application/vnd.github+json",
		},
		retry: { maxAttempts: 2, baseDelayMs: 500 },
	});
	if (!result.ok) return result;

	const meta: ForgeRepoMeta = {
		description: result.value.description || undefined,
		stars: result.value.stargazers_count ?? 0,
		language: result.value.language || undefined,
		avatarUrl: result.value.owner?.avatar_url,
	};
	await cache.set(cacheKey, meta);
	return ok(meta);
}
