/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import { createRichLinkHandlers } from "@kuristina/domain/richlinks";

export default defineCommand({
	aliases: "embed",
	description: "Shows a rich embed for a GitHub/Forgejo/Twitter/Bluesky/Fediverse/song link.",
	args: {
		url: arg.string({ description: "The link to embed", required: true, greedy: true }),
	},
	async exec(ctx) {
		const url = ctx.args.url.trim();

		for (const handler of createRichLinkHandlers(ctx.services)) {
			const [item] = handler.items(url);
			if (!item) continue;

			const payload = await item.render();
			if (payload) return void await ctx.reply(payload);
		}

		await ctx.error("mb but that doesn't rly look like a link i know how to embed mate");
	},
});
