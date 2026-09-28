/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { GatewayIntents } from "@discordeno/types";
import { createBot, createDesiredPropertiesObject, createLogger, LogLevels } from "@discordeno/bot";
import { createDiscordSource } from "@kuristina/domain/conversation";
import type { Services } from "@kuristina/domain/services";
import type { DiscordBot } from "@kuristina/discord-bot";
import { prepareClient } from "./patcher/mod.ts";
import { createClientEvents } from "./events.ts";

const desiredProperties = createDesiredPropertiesObject({
	user: { id: true, username: true, globalName: true, discriminator: true },
	member: { id: true, guildId: true, user: true },
	guild: { id: true },
	channel: { id: true, guildId: true, type: true },
	message: {
		id: true,
		channelId: true,
		guildId: true,
		author: true,
		content: true,
		mentions: true,
		reactions: true,
		messageReference: true,
		referencedMessage: true,
	},
	messageReference: { channelId: true, guildId: true, messageId: true },
	emoji: { id: true, name: true },
});

type ClientDesiredProperties = Required<typeof desiredProperties>;

function createBaseClient(token: string) {
	return createBot({
		token,
		desiredProperties: desiredProperties as ClientDesiredProperties,
		intents: GatewayIntents.Guilds |
			GatewayIntents.GuildMessages |
			GatewayIntents.MessageContent |
			GatewayIntents.GuildMessageReactions |
			GatewayIntents.DirectMessageReactions,
		loggerFactory: (name) => createLogger({ logLevel: LogLevels.Info, name }),
	});
}

export type DiscordClient = ReturnType<typeof createBaseClient>;

export interface ClientHandle {
	readonly client: DiscordClient;
	readonly bot: DiscordBot;

	shutdown(): Promise<void>;
}

export function createClient(bot: DiscordBot, services: Services): DiscordClient {
	const client = createBaseClient(services.config.discord.client.token);
	prepareClient(client);

	services.conversation.addSource(createDiscordSource("client", 1, {
		message: async (channelId, id) =>
			(await client.helpers.getMessages(channelId, { around: id, limit: 1 })).find((m) =>
				m.id === id
			),
		before: (channelId, before, limit) => client.helpers.getMessages(channelId, { before, limit }),
	}));

	Object.assign(client.events, createClientEvents(bot, client, services));
	client.events.ready = ({ user }) => logger.info(`markov client meowing as ${user.tag} :3`);

	return client;
}

export async function startClient(bot: DiscordBot, services: Services): Promise<ClientHandle> {
	const client = createClient(bot, services);
	await client.start();

	logger.yay(`client started as ${client.id}`);
	return { bot, client, shutdown: () => client.shutdown() };
}
