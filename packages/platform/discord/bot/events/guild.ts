/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Services } from "@kuristina/domain/services";
import type { DiscordBot } from "../factory.ts";
import type { GuildCreate, GuildDelete } from "../types/mod.ts";
import { syncGuildProfile } from "../lifecycle/guild-profile.ts";
import { reconcileGuild } from "../lifecycle/presence.ts";

export function createGuildHandlers(bot: DiscordBot, services: Services): {
	guildCreate: GuildCreate;
	guildDelete: GuildDelete;
} {
	const { repos } = services;

	return {
		guildCreate: async (guild) => {
			await reconcileGuild(bot, repos, guild.id);
			await syncGuildProfile(repos, guild.id);
		},

		guildDelete: async (guild) => {
			const result = await repos.members.reconcileGuild(guild.id, new Set());
			if (!result.ok) logger.boo("guildDelete: failed to purge guild presence:", result.error);
		},
	};
}
