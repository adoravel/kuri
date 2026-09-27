/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { scheduleMaintenance } from "@kuristina/database";
import { registerAllCommands } from "@kuristina/commands/registry";
import type { Services } from "@kuristina/domain/services";
import { generateMissingIcons } from "scripts/generate-icons.ts";
import { createDiscordBot, type DiscordBot } from "./factory.ts";
import { reconcileIcons } from "./lifecycle/icons.ts";
import { confirmRestartIfPending } from "./lifecycle/restart.ts";
import { schedulePresenceReconciliation } from "./lifecycle/presence.ts";
import { reconcileSlashCommands } from "./lifecycle/slash-commands.ts";

export interface BotHandle {
	readonly bot: DiscordBot;
	shutdown(): Promise<void>;
}

export const startBot = (services: Services): Promise<BotHandle> =>
	runBotLifecycle(createDiscordBot(services), services);

export async function runBotLifecycle(
	bot: DiscordBot,
	services: Services,
): Promise<BotHandle> {
	const { config, db, repos } = services;

	await bot.start();
	await confirmRestartIfPending(bot, repos);

	const generated = await generateMissingIcons();
	if (generated.generated > 0) {
		logger.yay(`icons: generated ${generated.generated} missing icons at startup`);
	}
	await reconcileIcons(bot, repos);

	registerAllCommands();
	await reconcileSlashCommands(bot, repos);

	const stopPresence = schedulePresenceReconciliation(bot, repos);
	const stopMaintenance = scheduleMaintenance(db, repos, {
		cacheTtlSeconds: config.sqlite.musicLinkCacheTtlSeconds,
		companionRetentionSeconds: config.sqlite.companionRetentionSeconds,
		lastfmCacheTtlSeconds: config.modules.lastfm.cacheTtlSeconds,
	}, config.sqlite.maintenanceIntervalMs);

	logger.yay(`bot started as ${bot.id}`);

	return {
		bot,
		async shutdown() {
			stopPresence();
			stopMaintenance();
			await bot.shutdown();
		},
	};
}
