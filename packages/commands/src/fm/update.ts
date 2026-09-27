/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { defineCommand } from "@kuristina/commands/core";

export const update = defineCommand({
	aliases: ["update", "u"],
	description: "Forces a fresh Last.fm fetch for your linked account.",
	category: "fm",
	cooldownMs: 15_000,
	async exec(ctx) {
		const account = await ctx.resolve(ctx.services.repos.scrobble.getDefault(ctx.user.id));
		if (account === undefined) return;
		if (!account) {
			return void await ctx.error(
				"you don't have a Last.fm account linked yet, run `fm login` first",
			);
		}

		await ctx.services.lastfm.cache.invalidateForUser(account.username);
		await ctx.success(
			`cleared cached Last.fm data for **${account.username}**. the next lookup will be fresh`,
		);
	},
});
