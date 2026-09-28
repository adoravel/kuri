/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { bootstrap, type SurfaceHandle } from "@kuristina/runtime";
import { startBot } from "@kuristina/discord-bot";
import { type ClientHandle, startClient } from "@kuristina/discord-client";
import { hasClientAccount } from "@kuristina/config";
import type { Services } from "@kuristina/domain/services";

async function init(services: Services): Promise<SurfaceHandle> {
	const bot = await startBot(services);

	let client: ClientHandle | undefined;
	if (hasClientAccount()) {
		try {
			client = await startClient(bot.bot, services);
		} catch (e) {
			logger.boo("client failed to start, continuing with the bot only:", e);
		}
	}

	return {
		async shutdown(): Promise<void> {
			try {
				await client?.shutdown();
			} finally {
				await bot.shutdown();
			}
		},
	};
}

if (import.meta.main) {
	await bootstrap(init);
}
