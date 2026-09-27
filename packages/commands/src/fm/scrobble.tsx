/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import { parseMusicQuery, PROVIDER } from "./helper.ts";

function Scrobbled({ artist, track }: { artist: string; track: string }) {
	return (
		<message>
			<h3>
				<icon name="waveform" />
				{`  Scrobble submitted`}
			</h3>
			<sub>
				<strong>
					<a href={`https://last.fm/music/${track}`}>{track}</a>
				</strong>{" "}
				by <a href={`https://last.fm/music/${artist}`}>{artist}</a>
			</sub>
			<hr spacing={2} />
			<sub>
				{PROVIDER}
			</sub>
		</message>
	);
}

export default defineCommand({
	aliases: "scrobble",
	description: "Manually scrobbles a track to your linked Last.fm account.",
	category: "fm",
	cooldownMs: 3_000,
	args: {
		query: arg.string({
			surfaces: ["text"],
			greedy: true,
			required: false,
			description: "artist | track",
		}),
		artist: arg.string({ surfaces: ["slash"], required: false, description: "artist name" }),
		track: arg.string({ surfaces: ["slash"], required: false, description: "track name" }),
	},
	async exec(ctx) {
		const key = await ctx.resolve(ctx.services.repos.scrobble.getSessionKey(ctx.user.id, PROVIDER));
		if (key === undefined) return;
		if (!key) {
			return void await ctx.error(
				"Your Last.fm link doesn't have write access yet. Run `fm login` again to grant it, then retry this.",
			);
		}

		let artist: string | undefined = ctx.args.artist, track: string | undefined = ctx.args.track;
		if (!artist || !track) {
			[artist, track] = parseMusicQuery(ctx.args.query);
		}
		if (!artist || !track) {
			return void await ctx.error("give me `artist | track`");
		}

		const provider = ctx.services.scrobbling;
		if (!provider.track.scrobble) {
			return void await ctx.error(`${PROVIDER} doesn't support manual scrobbling`);
		}

		const timestamp = Math.floor(Date.now() / 1000);
		const result = await ctx.resolve(provider.track.scrobble(key, artist, track, timestamp));
		if (!result) return;

		if (result.ignored > 0) {
			return ctx.error("Failed to scrobble **${parsed.track}** by **${parsed.artist}**");
		}
		await ctx.reply(<Scrobbled artist={artist} track={track} />);
	},
});
