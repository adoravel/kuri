/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type AsyncResult, mapWithConcurrency, ok } from "@kuristina/core";
import type { Services } from "@kuristina/domain/services";
import type { AppError } from "@kuristina/errors";
import { md } from "@kuristina/discord-ui";

export const PROVIDER = "last.fm" as const;
export const MAX_SHOWN = 15;
export const CONCURRENCY_LIMIT = 5;

export interface RankedResult {
	discordId: bigint;
	playcount: number;
	imageUrl: string;
}

interface HasScrobbleData {
	individualUserScrobbles: number;
	imageUrl: string;
}

export function extractParagraphs(
	content: string | undefined,
	count: number,
	url?: string | null,
): string | undefined {
	if (!content || count <= 0) return "";

	let index = 0;
	let reachedEnd = false;

	for (let i = 0; i < count; i++) {
		const nextBreak = content.indexOf("\n\n", index);

		if (nextBreak === -1) {
			reachedEnd = true;
			break;
		}
		index = nextBreak + 2;
	}

	const extracted = reachedEnd ? content : content.slice(0, index - 2);
	const trimmedResult = extracted.trim();

	const firstPeriod = trimmedResult.indexOf(".");
	let output = firstPeriod !== -1 ? trimmedResult.slice(0, firstPeriod + 1) : trimmedResult;

	if (url) {
		output += " " + md.link("Read more", url);
	}
	return output;
}

export function parseMusicQuery(query?: string): [string | undefined, string | undefined] {
	if (!query) return [undefined, undefined];

	let bestIndex = -1;
	let maxScore = -1;

	for (let i = 0; i < query.length; i++) {
		const char = query[i];

		if (char === "-" || char === "|") {
			let currentScore = 0;
			const hasLeftSpace = i > 0 && query[i - 1] === " ";
			const hasRightSpace = i < query.length - 1 && query[i + 1] === " ";

			if (hasLeftSpace && hasRightSpace) {
				currentScore = 3;
			} else if (hasLeftSpace || hasRightSpace) {
				currentScore = 2;
			} else {
				currentScore = 1;
			}

			if (currentScore >= maxScore) {
				maxScore = currentScore;
				bestIndex = i;
			}
		}
	}

	if (bestIndex === -1) {
		const cleanQuery = query.trim();
		return cleanQuery ? [undefined, cleanQuery] : [undefined, undefined];
	}

	const artist = query.substring(0, bestIndex).trim() || undefined;
	const work = query.substring(bestIndex + 1).trim() || undefined;

	return [artist, work];
}

export function fetchLinkedAccounts(
	services: Services,
	guildId: bigint | undefined,
): AsyncResult<Map<bigint, string> | undefined, AppError> {
	if (!guildId) return Promise.resolve(ok(undefined));
	return services.repos.scrobble.getAllForProviderInGuild(PROVIDER, guildId);
}

export async function fetchPlaycounts<T extends HasScrobbleData>(
	entries: [bigint, string][],
	fetch: (username: string) => AsyncResult<T, unknown>,
): Promise<PromiseSettledResult<{ discordId: bigint; data?: T }>[]> {
	return await mapWithConcurrency(entries, CONCURRENCY_LIMIT, async ([discordId, username]) => {
		const result = await fetch(username);
		return { discordId, data: result.ok ? result.value : undefined };
	});
}

export function rankResults<T extends HasScrobbleData>(
	settled: PromiseSettledResult<{ discordId: bigint; data?: T }>[],
	maxShown: number,
): { ranked: RankedResult[]; errors: number; imageUrl?: string } {
	const results = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
	const errors = results.filter((r) => !r.data).length +
		settled.filter((r) => r.status === "rejected").length;

	for (const r of settled) {
		if (r.status === "rejected") {
			logger.boo("whoknows: request failed: " + r.reason);
		}
	}

	const ranked = results
		.filter((r): r is { discordId: bigint; data: T } =>
			!!r.data && r.data.individualUserScrobbles > 0
		)
		.sort((a, b) => b.data.individualUserScrobbles - a.data.individualUserScrobbles)
		.slice(0, maxShown);

	return {
		ranked: ranked.map(($) => ({
			discordId: $.discordId,
			imageUrl: $.data.imageUrl,
			playcount: $.data.individualUserScrobbles,
		})),
		errors,
		imageUrl: ranked.findLast((x) => x.data?.imageUrl)?.data?.imageUrl,
	};
}

type ResolveResult = { artist: string | undefined; track: string | undefined };

export interface MusicContext {
	readonly user: { id: bigint };
	readonly services: Services;
	readonly args: { query?: string; artist?: string; track?: string };
}

async function latestScrobble(ctx: { user: { id: bigint }; services: Services }) {
	const own = await ctx.services.repos.scrobble.getDefault(ctx.user.id);
	if (!own.ok || !own.value) return undefined;

	const recent = await ctx.services.lastfm.getRecentTracks(own.value.username, { limit: 1 });
	return recent.ok ? recent.value.track[0] : undefined;
}

export async function resolveArtistAndTrack(
	ctx: MusicContext,
	album?: boolean,
): Promise<ResolveResult> {
	const query = ctx.args.query?.trim();

	let artist: string | undefined = ctx.args.artist;
	let track: string | undefined = ctx.args.track;

	if (query) {
		[artist, track] = parseMusicQuery(query);
	}

	if (!artist || !track) {
		const recent = await latestScrobble(ctx);
		if (recent) {
			artist = recent.artist["#text"] ?? recent.artist.name;
			track = album === true ? (recent.album?.["#text"] ?? recent.name) : recent.name;
		}
	}

	return { artist, track };
}

export async function getLatestArtist(
	ctx: { user: { id: bigint }; services: Services },
): Promise<string | undefined> {
	const recent = await latestScrobble(ctx);
	return recent?.artist["#text"] ?? recent?.artist?.name;
}
