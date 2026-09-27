/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type AsyncResult, type CacheStore, type NetworkError, ok } from "@kuristina/core";
import { getAlbumInfo } from "../lastfm/api/album.ts";
import { getTrackInfo } from "../lastfm/api/track.ts";
import { searchRelease } from "../brainz/mod.ts";
import type { LastFmError } from "../lastfm/errors.ts";

export interface MusicMetadata {
	description?: string;
	releaseDate?: string;
}

export type MusicMetadataKind = "song" | "album";

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function getMusicMetadata(
	cache: CacheStore,
	artist: string,
	title: string,
	kind: MusicMetadataKind,
): AsyncResult<MusicMetadata, NetworkError | LastFmError> {
	const cacheKey = `music-meta:${kind}:${artist.toLowerCase()}:${title.toLowerCase()}`;
	const cached = await cache.get<MusicMetadata>(cacheKey, CACHE_TTL_SECONDS);
	if (cached) return ok(cached);

	const [description, release] = await Promise.all([
		kind === "album" ? getAlbumInfo(artist, title) : getTrackInfo(artist, title),
		searchRelease(artist, title),
	]);

	const meta: MusicMetadata = {};
	if (description.ok && description.value.wiki?.summary) {
		meta.description = description.value.wiki.summary;
	}
	if (release.ok && release.value?.date) {
		meta.releaseDate = release.value.date;
	}

	await cache.set(cacheKey, meta);
	return ok(meta);
}
