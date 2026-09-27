/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { GatewayIntents } from "@discordeno/types";
import { createBot, createDesiredPropertiesObject, createLogger, LogLevels } from "@discordeno/bot";
import { createProxyCache } from "dd-cache-proxy";
import type { Services } from "@kuristina/domain/services";
import { prepareClient } from "./patcher/mod.ts";
import { createClientEvents } from "./events.ts";

const desiredProperties = createDesiredPropertiesObject({
	user: { id: true, username: true, discriminator: true },
	member: { id: true, guildId: true, user: true },
	guild: { id: true },
	message: {
		id: true,
		channelId: true,
		guildId: true,
		author: true,
		content: true,
		mentions: true,
		reactions: true,
	},
	channel: { id: true, guildId: true, type: true },
	defaultReactionEmoji: {
		emojiId: true,
		emojiName: true,
	},
	emoji: {
		id: true,
		name: true,
		roles: true,
		user: true,
	},
});

type ClientDesiredProperties = Required<typeof desiredProperties>;

function createProxiedClient(token: string) {
	const client = createBot({
		token,
		desiredProperties: desiredProperties as ClientDesiredProperties,
		intents: GatewayIntents.Guilds |
			GatewayIntents.GuildMessages |
			GatewayIntents.MessageContent |
			GatewayIntents.GuildMessageReactions |
			GatewayIntents.DirectMessageReactions,
		loggerFactory: (name) => createLogger({ logLevel: LogLevels.Info, name }),
	});

	return createProxyCache(client, { desiredProps: { guild: [] } });
}

export type DiscordClient = ReturnType<typeof createProxiedClient>;

export interface ClientHandle {
	readonly client: DiscordClient;
	shutdown(): Promise<void>;
}

export function createClient(services: Services): DiscordClient {
	const client = createProxiedClient(services.config.discord.client.token);
	prepareClient(client);

	Object.assign(client.events, createClientEvents(client, services));
	client.events.ready = ({ user }) => logger.info(`markov client meowing as ${user.tag} :3`);

	return client;
}

export async function startClient(services: Services): Promise<ClientHandle> {
	const client = createClient(services);
	await client.start();

	logger.yay(`client started as ${client.id}`);
	return { client, shutdown: () => client.shutdown() };
}
