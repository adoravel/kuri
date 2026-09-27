/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type AsyncResult, map } from "@kuristina/core";
import type { LastFmService } from "@kuristina/services/music/last.fm";
import type {
	ExtendedScrobbleTrackInfo,
	ScrobbleError,
	ScrobbleTrackInfo,
	TrackScrobbleProvider,
} from "./types.ts";

export function createTrackProvider(lastfm: LastFmService): TrackScrobbleProvider {
	function getInfo(
		artist: string,
		track: string,
		exact: boolean,
		username?: string,
	): AsyncResult<ScrobbleTrackInfo | ExtendedScrobbleTrackInfo, ScrobbleError> {
		return map(lastfm.getTrackInfo(artist, track, username, !exact))(($) => ({
			name: $.name,
			artist: $.artist.name,
			href: $.url,
			imageUrl: $.highestQualityImage["#text"],
			individualUserScrobbles: Number($.userplaycount ?? 0),
		}));
	}

	return {
		getInfo: getInfo as TrackScrobbleProvider["getInfo"],

		love: (sessionKey, artist, track) => lastfm.loveTrack(sessionKey, artist, track),
		unrate: (sessionKey, artist, track) => lastfm.unloveTrack(sessionKey, artist, track),

		scrobble: (sessionKey, artist, track, timestamp) =>
			map(lastfm.scrobble(sessionKey, [{ artist, track, timestamp }]))(($) => ({
				accepted: $.accepted ?? $["@attr"].accepted,
				ignored: $.ignored ?? $["@attr"].ignored,
			})),
	};
}
