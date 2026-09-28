/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { createProxyCache } from "dd-cache-proxy";
import {
	createBot,
	createDesiredPropertiesObject,
	createLogger,
	GatewayIntents,
	LogLevels,
} from "@discordeno/bot";

import { getConfig } from "@kuristina/config";
import type { Services } from "@kuristina/domain/services";

import { createDiscordSource } from "@kuristina/domain/conversation";

import { createAllEventHandlers } from "./events/mod.ts";

const desiredProperties = createDesiredPropertiesObject({
	user: {
		id: true,
		discriminator: true,
		username: true,
		globalName: true,
		avatar: true,
		toggles: true,
	},
	guild: {
		id: true,
		ownerId: true,
		icon: true,
		channels: true,
		name: true,
		emojis: true,
		roles: true,
		members: true,
		permissions: true,
	},
	roleColors: {
		primaryColor: true,
	},
	member: {
		id: true,
		avatar: true,
		user: true,
		roles: true,
		guildId: true,
		permissions: true,
	},
	message: {
		id: true,
		interaction: true,
		channelId: true,
		guildId: true,
		author: true,
		components: true,
		content: true,
		member: true,
		mentions: true,
		nonce: true,
		type: true,
		messageReference: true,
		editedTimestamp: true,
		reactions: true,
		referencedMessage: true,
	},
	messageReference: {
		channelId: true,
		guildId: true,
		messageId: true,
	},
	channel: {
		id: true,
		guildId: true,
		name: true,
		parentId: true,
		permissions: true,
		permissionOverwrites: true,
		position: true,
		type: true,
	},
	emoji: {
		id: true,
		name: true,
		roles: true,
		user: true,
	},
	role: {
		id: true,
		guildId: true,
		name: true,
		icon: true,
		colors: true,
		color: true,
		permissions: true,
		unicodeEmoji: true,
		flags: true,
		position: true,
		tags: true,
	},
	interaction: {
		id: true,
		guild: true,
		guildId: true,
		data: true,
		member: true,
		type: true,
		user: true,
		token: true,
		message: true,
		channel: true,
		channelId: true,
		context: true,
		version: true,
		locale: true,
	},
});

interface BotDesiredProperties extends Required<typeof desiredProperties> {}

function createBaseBot() {
	return createBot({
		token: getConfig().discord.token,
		desiredProperties: desiredProperties as BotDesiredProperties,
		intents: GatewayIntents.Guilds |
			GatewayIntents.GuildMembers |
			GatewayIntents.GuildMessageReactions |
			GatewayIntents.GuildMessages |
			GatewayIntents.MessageContent |
			GatewayIntents.DirectMessageReactions |
			GatewayIntents.GuildMessageReactions,
		loggerFactory: (name) => createLogger({ logLevel: LogLevels.Info, name }),
		gateway: {
			cache: {
				requestMembers: { enabled: true },
			},
		},
	});
}

function createProxiedBot() {
	return createProxyCache(createBaseBot(), {
		desiredProps: { guild: ["ownerId", "members", "roles", "channels"] },
	});
}

export type DiscordBot = ReturnType<typeof createProxiedBot>;

export function createDiscordBot(services: Services): DiscordBot {
	const bot = createProxiedBot();

	services.conversation.addSource(createDiscordSource("bot", 0, {
		message: (channelId, id) => bot.helpers.getMessage(channelId, id),
		before: (channelId, before, limit) => bot.helpers.getMessages(channelId, { before, limit }),
	}));

	Object.assign(bot.events, createAllEventHandlers(bot, services));
	bot.events.ready = ({ user }) => logger.info(`meowing as ${user.tag} :3`);

	return bot;
}
