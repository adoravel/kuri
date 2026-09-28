/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { StringStream } from "@kuristina/commands";
import { COMMAND_PREFIXES, executeTextCommand } from "@kuristina/commands/core";
import { createRichLinkService } from "@kuristina/domain/richlinks";
import { observeDiscordMessage } from "@kuristina/domain/conversation";
import type { Services } from "@kuristina/domain/services";
import type { DiscordBot } from "../factory.ts";
import type { Message, MessageCreate, MessageDelete, MessageUpdate } from "../types/mod.ts";
import { createRichLinkPlatform, toSourceMessage } from "./richlinks.ts";

const isCommand = (content: string): boolean => {
	const input = content.trimStart().toLowerCase();
	return COMMAND_PREFIXES.some((prefix) => input.startsWith(prefix));
};

export function createMessageHandlers(bot: DiscordBot, services: Services): {
	messageCreate: MessageCreate;
	messageUpdate: MessageUpdate;
	messageDelete: MessageDelete;
} {
	const richLinks = createRichLinkService(services, createRichLinkPlatform(bot));
	const companions = services.repos.messageCompanions;

	const dispatch = async (message: Message): Promise<void> => {
		observeDiscordMessage(services.conversation, message);

		if (message.author.bot || !message.guildId) return;

		const command = isCommand(message.content);
		const edited = message.editedTimestamp != null;

		if (command || edited) {
			await executeTextCommand(bot, message, new StringStream(message.content), services)
				.catch((e) => logger.boo("text command failed:", e));
		}

		if (!command) await richLinks.handle(toSourceMessage(message));
	};

	return {
		messageCreate: dispatch,
		messageUpdate: dispatch,
		messageDelete: async (message) => {
			const linked = await companions.getForSource(message.id);
			if (!linked.ok || !linked.value.length) return;

			await Promise.all(
				linked.value.map((c) =>
					bot.helpers.deleteMessage(c.channelId, c.responseMessageId).catch(() => {})
				),
			);
			await companions.deleteForSource(message.id);
		},
	};
}
