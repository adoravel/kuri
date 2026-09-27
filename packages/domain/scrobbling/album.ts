/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type AsyncResult, map } from "@kuristina/core";
import type { LastFmService } from "@kuristina/services/music/last.fm";
import type {
	AlbumScrobbleProvider,
	ExtendedScrobbleAlbum,
	ScrobbleAlbum,
	ScrobbleError,
} from "./types.ts";

export function createAlbumProvider(lastfm: LastFmService): AlbumScrobbleProvider {
	function getInfo(
		artist: string,
		album: string,
		exact: boolean,
		username?: string,
	): AsyncResult<ScrobbleAlbum | ExtendedScrobbleAlbum, ScrobbleError> {
		return map(lastfm.getAlbumInfo(artist, album, username, !exact))(($) => ({
			name: $.name,
			artist: $.artist,
			href: $.url,
			tags: $.tags?.tag,
			bio: username ? $.wiki?.summary : ($.wiki?.summary ?? $.wiki?.content),
			imageUrl: $.highestQualityImage["#text"],
			individualUserScrobbles: Number($.userplaycount ?? 0),
		}));
	}

	return { getInfo: getInfo as AlbumScrobbleProvider["getInfo"] };
}
