/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { AsyncResult } from "@kuristina/core";
import type { LastFmError } from "@kuristina/services/music/last.fm";

export type ScrobbleProviderName = "last.fm";
export type ScrobbleError = LastFmError;

export interface ScrobbleArtist {
	name: string;
	href: string;
	bio?: string;
	tags?: { name: string; url?: string }[];
	imageUrl: string;
}

export interface ExtendedScrobbleArtist extends ScrobbleArtist {
	individualUserScrobbles: number;
}

export interface ArtistTopMedia {
	name: string;
	playcount: number;
	image: string;
	href: string;
}

export interface ScrobbleAlbum {
	name: string;
	artist: string;
	href: string;
	imageUrl: string;
	tags?: { name: string; url?: string }[];
	bio?: string;
}

export interface ExtendedScrobbleAlbum extends ScrobbleAlbum {
	individualUserScrobbles: number;
}

export interface ScrobbleTrackInfo {
	name: string;
	artist: string;
	href: string;
	imageUrl: string;
}

export interface ExtendedScrobbleTrackInfo extends ScrobbleTrackInfo {
	individualUserScrobbles: number;
}

export interface ScrobbleReceipt {
	accepted: number;
	ignored: number;
}

export interface ArtistScrobbleProvider {
	getInfo(
		query: string,
		exact: boolean,
		username: string,
	): AsyncResult<ExtendedScrobbleArtist, ScrobbleError>;
	getInfo(query: string, exact: boolean): AsyncResult<ScrobbleArtist, ScrobbleError>;

	getTopTracks(
		query: string,
		limit: number,
		exact?: boolean,
	): AsyncResult<ArtistTopMedia[], ScrobbleError>;

	getTopAlbums(
		query: string,
		limit: number,
		exact?: boolean,
	): AsyncResult<ArtistTopMedia[], ScrobbleError>;
}

export interface AlbumScrobbleProvider {
	getInfo(
		artist: string,
		album: string,
		exact: boolean,
		username: string,
	): AsyncResult<ExtendedScrobbleAlbum, ScrobbleError>;
	getInfo(
		artist: string,
		album: string,
		exact: boolean,
	): AsyncResult<ScrobbleAlbum, ScrobbleError>;
}

export interface TrackScrobbleProvider {
	getInfo(
		artist: string,
		track: string,
		exact: boolean,
		username: string,
	): AsyncResult<ExtendedScrobbleTrackInfo, ScrobbleError>;
	getInfo(
		artist: string,
		track: string,
		exact: boolean,
	): AsyncResult<ScrobbleTrackInfo, ScrobbleError>;

	love?(sessionKey: string, artist: string, track: string): AsyncResult<void, ScrobbleError>;
	hate?(sessionKey: string, artist: string, track: string): AsyncResult<void, ScrobbleError>;
	unrate?(sessionKey: string, artist: string, track: string): AsyncResult<void, ScrobbleError>;

	scrobble(
		sessionKey: string,
		artist: string,
		track: string,
		timestamp: number,
	): AsyncResult<ScrobbleReceipt, ScrobbleError>;
}

export interface ScrobbleProvider {
	readonly name: ScrobbleProviderName;
	readonly artist: ArtistScrobbleProvider;
	readonly album: AlbumScrobbleProvider;
	readonly track: TrackScrobbleProvider;
}
