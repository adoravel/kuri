/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type AsyncResult, map } from "@kuristina/core";
import type { LastFmService } from "@kuristina/services/music/last.fm";
import type {
	ArtistScrobbleProvider,
	ArtistTopMedia,
	ExtendedScrobbleArtist,
	ScrobbleArtist,
	ScrobbleError,
} from "./types.ts";

const toTopMedia = <T extends { name: string; playcount: string; url: string }>(
	items: (T & { highestQualityImage: { "#text": string } })[],
): ArtistTopMedia[] =>
	items.map(($) => ({
		name: $.name,
		playcount: Number($.playcount),
		href: $.url,
		image: $.highestQualityImage["#text"],
	}));

export function createArtistProvider(lastfm: LastFmService): ArtistScrobbleProvider {
	function getInfo(
		query: string,
		exact: boolean,
		username?: string,
	): AsyncResult<ScrobbleArtist | ExtendedScrobbleArtist, ScrobbleError> {
		const autocorrect = !exact;
		const fetch = lastfm.cache.through(
			username ? "user_stats" : "metadata",
			"artist.getInfo",
			{ artist: query, username, autocorrect },
			() => lastfm.getArtistInfo(query, username, autocorrect),
		);

		return map(fetch)(($) => ({
			name: $.name,
			href: $.url,
			tags: $.tags?.tag,
			bio: username ? $.bio?.summary : ($.bio?.summary ?? $.bio?.content),
			imageUrl: $.highestQualityImage["#text"],
			individualUserScrobbles: Number($.stats?.userplaycount ?? 0),
		}));
	}

	return {
		getInfo: getInfo as ArtistScrobbleProvider["getInfo"],

		getTopTracks: (query, limit, exact = false) =>
			map(lastfm.getArtistTopTracks(query, limit, !exact))(toTopMedia),

		getTopAlbums: (query, limit, exact = false) =>
			map(lastfm.getArtistTopAlbums(query, limit, !exact))(toTopMedia),
	};
}
