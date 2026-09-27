/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import { Theme } from "@kuristina/discord-ui";
import {
	extractParagraphs,
	fetchLinkedAccounts,
	fetchPlaycounts,
	MAX_SHOWN,
	PROVIDER,
	type RankedResult,
	rankResults,
	resolveArtistAndTrack,
} from "./helper.ts";

function NoPlaysMessage({ artist, album }: { artist: string; album: string }) {
	return (
		<message>
			<h3>No plays found</h3>
			<p>
				No one here has scrobbled <strong>{album}</strong> by <strong>{artist}</strong>.
			</p>
		</message>
	);
}

function WhoKnowsAlbum({
	ranked,
	totalLinked,
	album,
}: {
	ranked: RankedResult[];
	totalLinked: number;
	album: {
		name: string;
		bio?: string;
		artist: string;
		href: string;
		tags?: { name: string }[];
		imageUrl: string;
	};
}) {
	const maxCount = ranked[0]?.playcount ?? 0;
	const tags = album.tags?.slice(0, 4)?.map(($) => `#${$.name}`)?.join("  ");

	return (
		<message>
			<section>
				<accessory>
					<thumbnail url={album.imageUrl} description={album.name} />
				</accessory>
				<h3>
					<icon name="disc" />
					{`  Top listeners of `}
					<a href={album.href}>{album.name}</a>
				</h3>
				<sub>
					by <a href={`https://last.fm/music/${album.artist}`}>{album.artist}</a>
					{tags && ` · ${tags}`}
				</sub>
				<blockquote>
					<ol>
						{ranked.map((r, i) => (
							<li>
								<br />
								{(i === 0 || r.playcount === maxCount)
									? <icon name="crown" />
									: <icon name="empty" />}
								{` <@${r.discordId}>`} — <strong>{r.playcount.toLocaleString()}</strong> plays
							</li>
						))}
					</ol>
				</blockquote>
			</section>
			<hr spacing={2} />
			{album.bio ? <sub>{extractParagraphs(album.bio, 1, album.href)}</sub> : (
				<sub>
					{ranked.length} of {totalLinked} linked members shown
					{" · "}
					{PROVIDER}
				</sub>
			)}
		</message>
	);
}

export default defineCommand({
	aliases: ["album", "wka", "wkalbum", "whoknowsalbum", "ep"],
	description:
		"Shows who in this server has scrobbled a given album the most. Use `artist | album`, or omit to use your last played album. Requires a linked Last.fm account.",
	category: "fm",
	args: {
		query: arg.string({
			surfaces: ["text"],
			greedy: true,
			required: false,
			description: "artist | album",
		}),
		artist: arg.string({ surfaces: ["slash"], required: false, description: "artist name" }),
		album: arg.string({ surfaces: ["slash"], required: false, description: "album name" }),
	},
	async exec(ctx) {
		const { artist, track: album } = await resolveArtistAndTrack(ctx, true);

		if (!artist || !album) {
			return void await ctx.error(
				`give me an artist and album, e.g. \`${Theme.prefix}whoknowsalbum Radiohead | OK Computer\``,
			);
		}

		if (!ctx.guildId) {
			return void await ctx.error("This command can only be used in a server.");
		}

		const provider = ctx.services.scrobbling;
		const albumInfo = await provider.album.getInfo(artist, album, false);
		if (!albumInfo.ok) {
			return void await ctx.error("Album not found.");
		}

		const { value: resolvedAlbum } = albumInfo;

		const linked = await fetchLinkedAccounts(ctx.services, ctx.guildId);
		if (!linked.ok || !linked.value?.size) {
			return void await ctx.error("No one has linked an account yet.");
		}

		const entries = [...linked.value.entries()];
		const settled = await fetchPlaycounts(
			entries,
			(username) => provider.album.getInfo(artist!, album!, true, username),
		);

		const { ranked, imageUrl } = rankResults(settled, MAX_SHOWN);

		if (!ranked.length) {
			await ctx.reply(
				<NoPlaysMessage artist={resolvedAlbum.artist} album={resolvedAlbum.name} />,
			);
			return;
		}

		if (imageUrl && imageUrl !== resolvedAlbum.imageUrl) resolvedAlbum.imageUrl = imageUrl;

		await ctx.reply(
			<WhoKnowsAlbum
				ranked={ranked}
				totalLinked={linked.value.size}
				album={resolvedAlbum}
			/>,
		);
	},
});
