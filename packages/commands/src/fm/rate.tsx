/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import type { TrackScrobbleProvider } from "@kuristina/domain/scrobbling";
import { PROVIDER, resolveArtistAndTrack } from "./helper.ts";

async function fetchTrackCard(
	provider: TrackScrobbleProvider,
	artist: string,
	track: string,
	username: string,
) {
	const info = await provider.getInfo(artist, track, false, username);
	return info.ok
		? {
			name: info.value.name,
			artist: info.value.artist,
			image: info.value.imageUrl,
			url: info.value.href,
		}
		: undefined;
}

function LoveResultCard({ action, name, artist, image, url }: {
	action: "love" | "unlove";
	name: string;
	artist: string;
	image?: string;
	url?: string;
}) {
	const title = url ? <a href={url}>{name}</a> : name;

	return (
		<message>
			<section>
				{image && (
					<accessory>
						<thumbnail url={image} description={name} />
					</accessory>
				)}
				<h3>
					<icon name={action === "love" ? "heart" : "x"} />
					{`  ${action === "love" ? "Loved" : "Un-loved"}`}
				</h3>
				<blockquote>
					<strong>{title}</strong>
					{" by "}
					{artist}
				</blockquote>
			</section>
			<hr spacing={2} />
			<sub>{PROVIDER}</sub>
		</message>
	);
}

function makeLoveCommand(action: "love" | "unlove") {
	const aliases = action === "love"
		? ["love", "would", "mrgghh", "fuckyeah", "lust", "favourite", "favorite", "l"]
		: ["unlove", "unrate", "fuck", "ul", "hate", "unheart"];
	const description = action === "love"
		? "Loves a track on Last.fm."
		: "Un-loves a track on Last.fm.";

	return defineCommand({
		aliases,
		description,
		category: "fm",
		cooldownMs: 3_000,
		args: {
			query: arg.string({
				description: "artist | track",
				required: false,
				greedy: true,
				surfaces: ["text"],
			}),
			artist: arg.string({
				description: "artist name",
				required: false,
				surfaces: ["slash"],
			}),
			track: arg.string({
				description: "track name",
				required: false,
				surfaces: ["slash"],
			}),
		},
		async exec(ctx) {
			const sessionKey = await ctx.resolve(
				ctx.services.repos.scrobble.getSessionKey(ctx.user.id, PROVIDER),
			);
			if (sessionKey === undefined) return;
			if (!sessionKey) {
				return void await ctx.error(
					"Your Last.fm link doesn't have write access yet. Run `fm login` again to grant it, then retry this.",
				);
			}

			const { artist, track } = await resolveArtistAndTrack(ctx);
			if (!artist || !track) {
				return void await ctx.error(
					"Couldn't figure out which track. Give me `artist | track`, or make sure you have recent scrobbles.",
				);
			}

			const provider = ctx.services.scrobbling;
			const fn = action === "love" ? provider.track.love : provider.track.unrate;
			if (!fn) return void await ctx.error(`${PROVIDER} doesn't support this`);

			const result = await fn(sessionKey, artist, track);
			if (!result.ok) return void await ctx.resolve(result);

			const user = await ctx.resolve(ctx.services.repos.scrobble.getDefault(ctx.user.id));
			if (!user) return;

			const card = await fetchTrackCard(provider.track, artist, track, user.username);
			await ctx.reply(
				card
					? (
						<LoveResultCard
							action={action}
							name={card.name}
							artist={card.artist}
							image={card.image}
							url={card.url}
						/>
					)
					: <LoveResultCard action={action} name={track} artist={artist} />,
			);
		},
	});
}

export const love = makeLoveCommand("love");
export const unrate = makeLoveCommand("unlove");
