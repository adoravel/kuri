/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
	type AsyncResult,
	type CacheStore,
	err,
	Errors,
	type NetworkError,
	ok,
} from "@kuristina/core";
import { config } from "@kuristina/config";
import { normaliseSongUrl } from "./utils.ts";
import { resolveViaOdesli } from "./odesli.ts";
import { findAppleMusicUrl } from "./itunes.ts";
import type { MusicLinkResult } from "./types.ts";

async function backfillAppleMusic(result: MusicLinkResult): Promise<MusicLinkResult> {
	if (result.links.appleMusic) return result;

	const appleUrl = await findAppleMusicUrl(result.title, result.artist);
	return appleUrl
		? { ...result, links: { ...result.links, appleMusic: appleUrl }, source: "odesli+itunes" }
		: result;
}

export async function resolveSongLink(
	cache: CacheStore,
	rawUrl: string,
): AsyncResult<MusicLinkResult, NetworkError> {
	const normalised = normaliseSongUrl(rawUrl);

	const cached = await cache.get<MusicLinkResult>(
		normalised,
		config.sqlite.musicLinkCacheTtlSeconds,
	);
	if (cached) return ok(cached);

	const resolved = await resolveViaOdesli(normalised);
	if (!resolved.ok) return resolved;

	const final = await backfillAppleMusic(resolved.value);
	await cache.set(normalised, final);
	return ok(final);
}

export async function resolveSongLinkByQuery(
	cache: CacheStore,
	artist: string,
	title: string,
): AsyncResult<MusicLinkResult, NetworkError> {
	const appleUrl = await findAppleMusicUrl(title, artist);
	if (!appleUrl) return err(Errors.network(`no match found for "${title}" by "${artist}"`));
	return await resolveSongLink(cache, appleUrl);
}
