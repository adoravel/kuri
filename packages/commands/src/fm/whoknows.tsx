/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import { map, ok } from "@kuristina/core";
import { Theme } from "@kuristina/discord-ui";
import {
	extractParagraphs,
	fetchLinkedAccounts,
	fetchPlaycounts,
	getLatestArtist,
	MAX_SHOWN,
	PROVIDER,
	type RankedResult,
	rankResults,
} from "./helper.ts";

function NoPlaysMessage({ artist }: { artist: string }) {
	return (
		<message>
			<h3>No plays found</h3>
			<p>
				No one here has scrobbled <strong>{artist}</strong>.
			</p>
		</message>
	);
}

function WhoKnows({
	ranked,
	totalLinked,
	artist,
}: {
	ranked: RankedResult[];
	totalLinked: number;
	artist: {
		name: string;
		bio?: string;
		href: string;
		tags?: { name: string }[];
		imageUrl: string;
	};
}) {
	const maxCount = ranked[0]?.playcount ?? 0;
	const tags = artist.tags?.slice(0, 5)?.map(($) => `#${$.name}`)?.join("  ");

	return (
		<message>
			<section>
				<accessory>
					<thumbnail url={artist.imageUrl} description={artist.name} />
				</accessory>
				<h3>
					<icon name="artist" />
					{`  Top listeners of `}
					<a href={artist.href}>{artist.name}</a>
				</h3>
				{tags && <sub>{tags}</sub>}
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
			{artist.bio ? <sub>{extractParagraphs(artist.bio, 1, artist.href)}</sub> : (
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
	aliases: ["artist", "whoknows", "wk", "w", "musician", "band"],
	description:
		"Shows who in this server has scrobbled a given artist the most, ranked by playcount. Requires a linked Last.fm account.",
	category: "fm",
	args: {
		global: arg.boolean({
			description: "whether this ranking won't be scoped to the current server",
			required: false,
		}),
		query: arg.string({
			description: "artist name",
			greedy: true,
		}),
	},
	async exec(ctx) {
		let query = ctx.args.query?.trim();

		if (!query) {
			query = await getLatestArtist(ctx);
		}
		if (!query) {
			return void await ctx.error(
				`Give me an artist name, e.g. \`${Theme.prefix}whoknows Katelyn Bleh\``,
			);
		}

		const provider = ctx.services.scrobbling;
		const skipAutocorrect = await ctx.services.repos.artistAliases.shouldSkipAutocorrect(query);
		const exact = skipAutocorrect.ok ? skipAutocorrect.value : false;

		const artistInfo = await map(provider.artist.getInfo(query, exact))((info) => {
			return { ...info, name: info.name || query };
		});

		if (!artistInfo.ok) {
			return void await ctx.error("Artist not found.");
		}

		const { value: artist } = artistInfo;

		if (artist.name.toLowerCase() !== query.toLowerCase()) {
			await ctx.services.repos.artistAliases.link(query, artist.name, "autocorrect");
		}
		const group = await ctx.services.repos.artistAliases.getGroup(artist.name);
		const names = group.ok ? group.value : [artist.name];

		const linked = ctx.args.global || !ctx.guildId
			? await ctx.services.repos.scrobble.getAllForProvider(PROVIDER)
			: await fetchLinkedAccounts(ctx.services, ctx.guildId);

		if (!linked.ok || !linked.value?.size) {
			return void await ctx.error("No one has linked an account yet.");
		}

		const entries = [...linked.value.entries()];
		const settled = await fetchPlaycounts(entries, async (username) => {
			const perAlias = await Promise.all(
				names.map((name) => provider.artist.getInfo(name, true, username)),
			);

			const found = perAlias.filter((r) => r.ok);
			if (!found.length) return perAlias[0];

			return ok({
				...found[0].value,
				individualUserScrobbles: found.reduce(
					(sum, r) => sum + r.value.individualUserScrobbles,
					0,
				),
			});
		});

		const { ranked, imageUrl } = rankResults(settled, MAX_SHOWN);

		if (!ranked.length) {
			await ctx.reply(<NoPlaysMessage artist={artist.name} />);
			return;
		}

		if (imageUrl && imageUrl !== artist.imageUrl) artist.imageUrl = imageUrl;

		await ctx.reply(
			<WhoKnows
				ranked={ranked}
				totalLinked={linked.value.size}
				artist={artist}
			/>,
		);
	},
});
