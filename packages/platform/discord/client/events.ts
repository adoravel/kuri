/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DiscordClient } from "./factory.ts";
import type { DiscordBot } from "@kuristina/discord-bot";
import type { MessageCreate, ReactionAdd } from "./types/mod.ts";
import type { Services } from "@kuristina/domain/services";
import { createMarkovHandler } from "@kuristina/domain/markov";
import { safe } from "@kuristina/core";

export function createClientEvents(
	bot: DiscordBot,
	client: DiscordClient,
	services: Services,
): {
	reactionAdd: ReactionAdd;
	messageCreate: MessageCreate;
} {
	const markovHandler = createMarkovHandler(services, {
		removeUserReaction: (channelId, messageId, userId, emoji) =>
			bot.helpers.deleteUserReaction(channelId, messageId, userId, emoji),
	});
 
	return {
		reactionAdd: async (reaction) => {
			const message = await safe(
				client.helpers.getMessages(reaction.channelId, { around: reaction.messageId, limit: 1 }),
			);
			if (!message.ok) {
				logger.boo("markov: failed to fetch message:", message.error);
				return;
			}
			if (!message.value.length) return;

			const result = await markovHandler.translateReactedMessage(
				client,
				message.value[0],
				reaction,
			);
			if (!result.ok) logger.boo("markov(reactionAdd):", result.error);
		},
		messageCreate: async (message) => {
			const result = await markovHandler.messageCreate(client, message);
			if (!result.ok) logger.boo("markov(messageCreate):", result.error);
		},
	};
}
