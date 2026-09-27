/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand, runPaginator } from "@kuristina/commands/core";
import type { Invocation } from "@kuristina/commands/core";
import { getHighestQualityImage, type LastFmTrack } from "@kuristina/services/music/last.fm";
import type { CreateMessageOptions } from "@kuristina/discord-bot";
import { NoAccountMessage } from "./login.tsx";
import { PROVIDER } from "./helper.ts";

const PAGE_SIZE = 7;

function runHistoryBrowser(ctx: Invocation, username: string): Promise<void> {
	return runPaginator(ctx, {
		id: "fm-history",
		renderPage: async (page): Promise<CreateMessageOptions> => {
			const recent = await ctx.services.lastfm.getRecentTracks(username, {
				limit: PAGE_SIZE,
				page: page + 1,
			});

			if (!recent.ok || !recent.value.track.length) return <EmptyHistoryPage page={page} />;
			return <HistoryPage tracks={recent.value.track} page={page} />;
		},
	});
}

function EmptyHistoryPage({ page }: { page: number }) {
	return (
		<message>
			<h3>
				<icon name="clock" /> Nothing here
			</h3>
			<p>No scrobbles on page {page + 1}.</p>
		</message>
	);
}

function HistoryPage({ tracks, page }: { tracks: LastFmTrack[]; page: number }) {
	const image = getHighestQualityImage(tracks[0].image);

	return (
		<message>
			<section>
				<accessory>
					<thumbnail url={image["#text"]} description={tracks[0].name} />
				</accessory>
				<h3>
					<icon name="clock" />
					{`  Recent scrobbles · `}
					page {page + 1}
				</h3>
				<ol>
					{tracks.map((t) => {
						const live = t["@attr"]?.nowplaying === "true";
						return (
							<li>
								{live && (
									<>
										<icon name="music" />
										{" "}
									</>
								)}
								<strong>{t.name}</strong>
								{" by "}
								{`${t.artist["#text"] ?? t.artist.name} `}
								<br />
								<sub>{live ? "now playing" : t.date?.uts ? `<t:${t.date.uts}:R>` : ""}</sub>
							</li>
						);
					})}
				</ol>
			</section>
			<hr spacing={2} />
			<sub>{PROVIDER}</sub>
		</message>
	);
}

export default defineCommand({
	aliases: ["recent", "history"],
	description: "Shows your (or someone's) recent Last.fm scrobbles.",
	category: "fm",
	cooldownMs: 3_000,
	args: { user: arg.user({ description: "whose history to show", required: false }) },
	async exec(ctx) {
		const userId = ctx.args.user ?? ctx.user.id;

		const account = await ctx.resolve(ctx.services.repos.scrobble.getDefault(userId));
		if (account === undefined) return;

		if (!account) return void await ctx.reply({ ...<NoAccountMessage /> });

		await runHistoryBrowser(ctx, account.username);
	},
});
