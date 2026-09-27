/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import { getHighestQualityImage, type LastFmTrack } from "@kuristina/services/music/last.fm";
import { NoAccountMessage } from "./login.tsx";
import { md } from "@kuristina/discord-ui";
import { renderPlatformLinks } from "@kuristina/embeds/musiclinks";

function NoScrobbles() {
	return (
		<message>
			<h3>
				<icon name="music" /> Nothing yet
			</h3>
			<p>No scrobbles found for your account.</p>
		</message>
	);
}

function TrackCard(
	{ track, live, user, totalScrobbles, links }: {
		track: LastFmTrack;
		live: boolean;
		user: string | null;
		totalScrobbles?: number;
		links: string[];
	},
) {
	const image = getHighestQualityImage(track.image);

	const loved = Number(track.loved) === 1;

	const albumText = track.album?.["#text"];
	const album = !albumText
		? undefined
		: track.album?.mbid
		? md.link(albumText, `https://musicbrainz.org/release/${track.album.mbid}`)
		: albumText;

	const footer: string[] = [];
	if (track.userplaycount !== undefined) {
		footer.push(
			`${track.userplaycount.toLocaleString()} play${
				track.userplaycount === 1 ? "" : "s"
			} of this track`,
		);
	}
	if (totalScrobbles !== undefined) {
		footer.push(`${totalScrobbles.toLocaleString()} scrobbles total`);
	}
	if (!live && track.date?.uts) {
		footer.push(`<t:${track.date.uts}:R>`);
	}
	footer.push("last.fm");

	return (
		<message>
			<section>
				<accessory>
					<thumbnail url={image["#text"]} description={track.name} />
				</accessory>
				<h3>
					<icon name={live ? "music" : "clock"} />
					{`  ${live ? "Now playing" : "Last played"}`}
					{user && ` · <@${user}>`}
				</h3>
				<blockquote>
					{loved
						? (
							<>
								<icon name="heart" />
								{" "}
							</>
						)
						: ""}
					<strong>
						<a href={track.url}>{track.name}</a>
					</strong>
					{" by "}
					<a href={track.artist.url}>{track.artist.name}</a>
					{album && (
						<>
							<br />
							<sub>- on the album: {album}</sub>
						</>
					)}
				</blockquote>
			</section>
			<hr />
			<sub>
				{links && <>{links.join(" · ")}{" · "}</>}
				{footer.join(" · ")}
			</sub>
		</message>
	);
}

export default defineCommand({
	aliases: ["now", "nowplaying", "np"],
	description: "Shows your currently playing (or most recently played) track on Last.fm.",
	category: "fm",
	cooldownMs: 3_000,
	args: { user: arg.user({ description: "whose scrobbles to show" }) },
	async exec(ctx) {
		const userId = ctx.args.user ?? ctx.user.id;

		const account = await ctx.services.repos.scrobble.getDefault(userId);
		if (!account.ok || !account.value) return void await ctx.reply({ ...<NoAccountMessage /> });

		const recent = await ctx.services.lastfm.getRecentTracks(account.value.username, {
			limit: 1,
			extended: true,
		});
		if (!recent.ok || !recent.value.track.length) {
			return void await ctx.reply({ ...<NoScrobbles /> });
		}

		const track = recent.value.track[0];
		const live = track["@attr"]?.nowplaying === "true";
		const totalScrobbles = Number(recent.value["@attr"]?.total) || undefined;

		const directLinks = await ctx.services.musicLinks.resolveByQuery(track.artist.name, track.name);
		if (!directLinks.ok) logger.boo(JSON.stringify(directLinks.error, null, "4"));
		const links = directLinks.ok ? renderPlatformLinks(directLinks.value) : [];

		await ctx.reply(
			<TrackCard
				track={track}
				live={live}
				user={ctx.user.id.toString()}
				totalScrobbles={totalScrobbles}
				links={links}
			/>,
		);
	},
});
