/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type AsyncResult, map, ok } from "@kuristina/core";
import type { LastFmError } from "../errors.ts";
import { getHighestQualityImage, type LastFmArtistSummary } from "./artist.ts";
import type { LastFmImage } from "../types.ts";
import { request } from "../http.ts";

export interface LastFmTrack {
	name: string;
	mbid?: string;
	url: string;
	artist: LastFmArtistSummary;
	album?: { mbid?: string; "#text": string };
	image?: LastFmImage[];
	date?: { uts: number; "#text": string };
	loved?: number;
	playcount?: number;
	userplaycount?: number;
	readonly "@attr"?: { nowplaying?: string };
	readonly wiki?: { summary?: string; content?: string };
}

export interface ScrobbleTrack {
	artist: string;
	track: string;
	timestamp: number;
	album?: string;
	context?: string;
	streamId?: string;
	chosenByUser?: boolean;
}

export interface ScrobbleResponse {
	accepted: number;
	ignored: number;
	"@attr": Record<string, string>;
}

export async function scrobble(
	sessionKey: string,
	tracks: ScrobbleTrack[],
): AsyncResult<ScrobbleResponse, LastFmError> {
	const params: Record<string, string | number> = {};

	for (let i = 0; i < tracks.length; i++) {
		const t = tracks[i];
		params[`artist[${i}]`] = t.artist;
		params[`track[${i}]`] = t.track;
		params[`timestamp[${i}]`] = t.timestamp;
		if (t.album) params[`album[${i}]`] = t.album;
		if (t.context) params[`context[${i}]`] = t.context;
		if (t.streamId) params[`streamId[${i}]`] = t.streamId;
		if (t.chosenByUser !== undefined) params[`chosenByUser[${i}]`] = t.chosenByUser ? 1 : 0;
	}

	const result = await request<{ scrobbles: ScrobbleResponse }>(
		"track.scrobble",
		params,
		sessionKey,
	);
	if (!result.ok) return result;

	return ok(result.value.scrobbles);
}

export async function updateNowPlaying(
	sessionKey: string,
	track: {
		artist: string;
		track: string;
		album?: string;
		context?: string;
		streamId?: string;
		duration?: number;
	},
): AsyncResult<void, LastFmError> {
	const params: Record<string, string | number> = {
		artist: track.artist,
		track: track.track,
	};
	if (track.album) params.album = track.album;
	if (track.context) params.context = track.context;
	if (track.streamId) params.streamId = track.streamId;
	if (track.duration) params.duration = track.duration;

	const result = await request<{ nowplaying: { "@attr": { nowplaying: string } } }>(
		"track.updateNowPlaying",
		params,
		sessionKey,
	);
	if (!result.ok) return result;

	return ok(undefined);
}

export function loveTrack(
	sessionKey: string,
	artist: string,
	track: string,
): AsyncResult<void, LastFmError> {
	const love = request("track.love", { artist, track }, sessionKey, true);
	return map(love)(() => undefined);
}

export function unloveTrack(
	sessionKey: string,
	artist: string,
	track: string,
): AsyncResult<void, LastFmError> {
	const unlove = request("track.unlove", { artist, track }, sessionKey, true);
	return map(unlove)(() => undefined);
}

export async function getTrackInfo(
	artist: string,
	track: string,
	username?: string,
	autocorrect = true,
): AsyncResult<LastFmTrack & { highestQualityImage: LastFmImage }, LastFmError> {
	const params: Record<string, string | number> = { artist, track };

	if (username) params.username = username;
	params.autocorrect = autocorrect ? 1 : 0;

	type Response = { track: LastFmTrack };

	return map(await request<Response>("track.getInfo", params))(($) => ({
		...$.track,
		highestQualityImage: getHighestQualityImage($.track.image),
	}));
}
