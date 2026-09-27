/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { LastFmService } from "@kuristina/services/music/last.fm";
import { createArtistProvider } from "./artist.ts";
import { createAlbumProvider } from "./album.ts";
import { createTrackProvider } from "./track.ts";
import type { ScrobbleProvider } from "./types.ts";

export function createScrobbleProvider(lastfm: LastFmService): ScrobbleProvider {
	return {
		name: "last.fm",
		artist: createArtistProvider(lastfm),
		album: createAlbumProvider(lastfm),
		track: createTrackProvider(lastfm),
	};
}

export * from "./types.ts";
