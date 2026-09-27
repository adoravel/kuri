/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import type { ArtistTopMedia } from "@kuristina/domain/scrobbling";
import { getLatestArtist, PROVIDER } from "./helper.ts";

function NoChartMessage({ artist }: { artist: string }) {
	return (
		<message>
			<h3>No top tracks found</h3>
			<p>
				Couldn't find top tracks for <strong>{artist}</strong>.
			</p>
		</message>
	);
}

function ArtistTopAlbums({ artist, entries }: { artist: string; entries: ArtistTopMedia[] }) {
	return (
		<message>
			<section>
				<accessory>
					<thumbnail url={entries[0]?.image} description={artist} />
				</accessory>
				<h3>
					<icon name="waveform" />
					{`  Top albums by `}
					<a href={`https://www.last.fm/music/${encodeURIComponent(artist)}`}>{artist}</a>
				</h3>
				<blockquote>
					<ol>
						{entries.map((e, i) => (
							<li>
								<br />
								{i === 0 ? <icon name="crown" /> : <icon name="empty" />}
								{` `}
								<a href={e.href}>{e.name}</a> — <strong>{e.playcount.toLocaleString()}</strong>{" "}
								plays
							</li>
						))}
					</ol>
				</blockquote>
			</section>
			<hr spacing={2} />
			<sub>
				top {entries.length} tracks
				{" · "}
				{PROVIDER}
			</sub>
		</message>
	);
}

export default defineCommand({
	aliases: ["artistalbums", "artistalbum", "aa", "ata"],
	description: "Shows the top albums for a given artist.",
	category: "fm",
	cooldownMs: 3_000,
	args: { artist: arg.string({ description: "artist name", greedy: true }) },
	async exec(ctx) {
		const query = ctx.args.artist || await getLatestArtist(ctx);
		if (!query) return void ctx.error("Artist not found");

		const provider = ctx.services.scrobbling;

		const result = await provider.artist.getTopAlbums(query, 10, false);
		if (!result.ok) return void await ctx.resolve(result);

		if (!result.value.length) {
			return void await ctx.reply({ ...<NoChartMessage artist={query} /> });
		}

		await ctx.reply({ ...<ArtistTopAlbums artist={query} entries={result.value} /> });
	},
});
