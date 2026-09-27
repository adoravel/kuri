/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CacheStore } from "@kuristina/core";
import { getAlbumInfo } from "./api/album.ts";
import { getArtistInfo, getArtistTopAlbums, getArtistTopTracks } from "./api/artist.ts";
import { getAuthToken, pollForSession } from "./api/auth.ts";
import { getTrackInfo, loveTrack, scrobble, unloveTrack } from "./api/track.ts";
import { getLovedTracks, getRecentTracks, getTopArtists } from "./api/user.ts";
import { createLastFmCache } from "./cache.ts";

export * from "./errors.ts";
export * from "./types.ts";
export * from "./http.ts";
export * from "./api/album.ts";
export * from "./api/artist.ts";
export * from "./api/track.ts";
export * from "./api/user.ts";
export * from "./api/auth.ts";
export * from "./cache.ts";

export function createLastFmService(cache: CacheStore) {
	return {
		getArtistInfo,
		getArtistTopTracks,
		getArtistTopAlbums,
		getAlbumInfo,
		getTrackInfo,
		getRecentTracks,
		getTopArtists,
		getLovedTracks,
		getAuthToken,
		pollForSession,
		loveTrack,
		unloveTrack,
		scrobble,
		cache: createLastFmCache(cache),
	};
}

export type LastFmService = ReturnType<typeof createLastFmService>;
