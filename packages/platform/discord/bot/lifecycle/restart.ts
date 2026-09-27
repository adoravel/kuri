/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { markPendingRestart, type Repositories, takePendingRestart } from "@kuristina/database";
import type { Invocation } from "@kuristina/commands/core";
import type { DiscordBot } from "../factory.ts";
import { sleep } from "@kuristina/core";

export async function requestRestart(invocation: Invocation, content: string): Promise<never> {
	const response = await invocation.reply({ content });
	if (response !== undefined) {
		await markPendingRestart(invocation.services.repos.state, response.channelId, response.id);
	}
	await sleep(2_500);
	logger.yay("restart: state saved, exiting for supervisor restart");
	Deno.exit(0);
}

export async function confirmRestartIfPending(
	bot: DiscordBot,
	repositories: Repositories,
): Promise<void> {
	const pending = await takePendingRestart(repositories.state);
	if (!pending) return;

	const { channelId, messageId } = pending;
	try {
		await bot.helpers.editMessage(channelId, messageId, {
			content: "haii we r so back,, <a:Mika67:1528181039070187612>",
		});
	} catch {
		try {
			await bot.helpers.sendMessage(channelId, {
				content: "haii we r so back,, <a:Mika67:1528181039070187612>",
			});
		} catch (e) {
			logger.boo("restart: failed to confirm restart:", e);
		}
	}
}
