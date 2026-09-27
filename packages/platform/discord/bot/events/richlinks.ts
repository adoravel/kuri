/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { MessageFlags } from "@discordeno/bot";
import type { RichLinkPlatform, SourceMessage } from "@kuristina/domain/richlinks";
import type { DiscordBot } from "../factory.ts";
import { BitwisePermissionFlags, type Message } from "../types/mod.ts";
import { hasChannelPermission } from "../resolve.ts";

export const toSourceMessage = (message: Message): SourceMessage => ({
	id: message.id,
	channelId: message.channelId,
	guildId: message.guildId,
	content: message.content,
});

export function createRichLinkPlatform(bot: DiscordBot): RichLinkPlatform {
	const suppressed = new Set<bigint>();

	return {
		async sendReply(message, payload) {
			const sent = await bot.helpers.sendMessage(message.channelId, {
				...payload,
				messageReference: {
					messageId: message.id,
					channelId: message.channelId,
					guildId: message.guildId,
					failIfNotExists: true,
				},
			});
			return { id: sent.id };
		},

		async deleteMessage(channelId, messageId) {
			await bot.helpers.deleteMessage(channelId, messageId);
		},

		async suppressEmbeds(message) {
			if (suppressed.has(message.id)) return;
			suppressed.add(message.id);

			try {
				await bot.helpers.editMessage(message.channelId, message.id, {
					flags: MessageFlags.SuppressEmbeds,
				});
			} catch (e) {
				suppressed.delete(message.id);
				logger.warn("rich-links: couldn't suppress original embed (needs manage messages):", e);
			}
		},

		canEmbed: (guildId, channelId) =>
			hasChannelPermission(bot, guildId, channelId, BitwisePermissionFlags.EMBED_LINKS),
	};
}
