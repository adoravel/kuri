/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Repositories } from "@kuristina/database";
import { config } from "@kuristina/config";
import type { DiscordBot } from "../factory.ts";

async function collectMemberIds(bot: DiscordBot, guildId: bigint): Promise<Set<bigint>> {
	const guild = await bot.cache.guilds.get(guildId);
	if (!guild?.members) {
		const members = await bot.gateway.requestMembers(guildId, { limit: 0, query: "" });
		return new Set(members.map(($) => BigInt($.user.id)));
	}
	return new Set(guild.members.keys());
}

export async function reconcileGuild(
	bot: DiscordBot,
	repositories: Repositories,
	guildId: bigint,
): Promise<void> {
	const memberIds = await collectMemberIds(bot, guildId);
	if (!memberIds.size) {
		logger.warn(`presence: chunk for guild ${guildId} returned no members, skipping`);
		return;
	}
	const result = await repositories.members.reconcileGuild(guildId, memberIds);
	if (!result.ok) {
		logger.boo(`presence: reconciliation failed for guild ${guildId}: ` + result.error);
		return;
	}
	logger.yay(
		`presence: guild ${guildId} reconciled (+${result.value.added} / -${result.value.removed})`,
	);
}

export async function reconcileAllGuilds(
	bot: DiscordBot,
	repositories: Repositories,
): Promise<void> {
	for await (const [guildId] of bot.cache.guilds.memory) {
		await reconcileGuild(bot, repositories, guildId);
	}
}

export function schedulePresenceReconciliation(
	bot: DiscordBot,
	repositories: Repositories,
): () => void {
	const intervalMs = config.presence.reconcileIntervalMs;
	if (intervalMs <= 0) return () => {};

	const timer = setInterval(() => void reconcileAllGuilds(bot, repositories), intervalMs);
	Deno.unrefTimer(timer);
	return () => clearInterval(timer);
}
