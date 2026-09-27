/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DiscordBot } from "../factory.ts";
import type { Events } from "../types/mod.ts";
import type { Services } from "@kuristina/domain/services";
import { createMessageHandlers } from "./message.ts";
import { createInteractionCreateHandler } from "./interaction.ts";
import { createMemberHandlers } from "./member.ts";
import { createGuildHandlers } from "./guild.ts";

const guarded = <T extends (...args: any[]) => any>(
	name: string,
	handler: T,
): T => {
	return (async (...args: Parameters<T>) => {
		try {
			return await handler(...args);
		} catch (e) {
			logger.boo(`[${name}] unhandled error:`, e);
		}
	}) as T;
};

function guardHandlers<T extends Record<string, (...args: any[]) => any>>(handlers: T): T {
	return Object.fromEntries(
		Object.entries(handlers).map(([name, fn]) => [name, guarded(name, fn)]),
	) as T;
}

export function createAllEventHandlers(bot: DiscordBot, services: Services): Events {
	const allHandlers = {
		...createMessageHandlers(bot, services),
		...createMemberHandlers(services),
		...createGuildHandlers(bot, services),
		interactionCreate: createInteractionCreateHandler(bot, services),
	};

	return guardHandlers(allHandlers);
}
