/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ChatMessage, ConversationStore, MessageSource } from "./types.ts";

export interface DiscordUserLike {
	readonly id: bigint;
	readonly username?: string | null;
	readonly globalName?: string | null;
}

export interface DiscordMessageLike {
	readonly id: bigint;
	readonly channelId: bigint;
	readonly content?: string | null;
	readonly author?: DiscordUserLike | null;
	readonly mentions?: readonly DiscordUserLike[] | null;
	readonly messageReference?: {
		readonly messageId?: bigint | null;
		readonly channelId?: bigint | null;
	} | null;
	readonly referencedMessage?: DiscordMessageLike | null;
}

const MENTION_RE = /<@!?(\d+)>/g;
const CUSTOM_EMOJI_RE = /<a?:(\w+):\d+>/g;
const MAX_STORED_CHARS = 500;

const displayName = (user: DiscordUserLike): string =>
	user.globalName || user.username || "someone";

export function toChatMessage(message: DiscordMessageLike): ChatMessage {
	const names = new Map<string, string>();
	for (const user of message.mentions ?? []) names.set(user.id.toString(), displayName(user));

	let text = (message.content ?? "")
		.replace(MENTION_RE, (_, id: string) => "@" + (names.get(id) ?? "someone"))
		.replace(CUSTOM_EMOJI_RE, ":$1:")
		.replace(/\s+/g, " ")
		.trim();
	if (text.length > MAX_STORED_CHARS) text = text.slice(0, MAX_STORED_CHARS - 1) + "…";

	return {
		id: message.id,
		channelId: message.channelId,
		authorId: message.author?.id ?? 0n,
		authorName: message.author ? displayName(message.author) : "someone",
		text,
		replyToId: message.messageReference?.messageId ?? undefined,
		replyToChannelId: message.messageReference?.channelId ?? undefined,
	};
}

function withEmbeddedParents(message: DiscordMessageLike): ChatMessage[] {
	const all = [toChatMessage(message)];
	for (let parent = message.referencedMessage; parent; parent = parent.referencedMessage) {
		all.push(toChatMessage(parent));
	}
	return all;
}

export function observeDiscordMessage(
	store: ConversationStore,
	message: DiscordMessageLike,
): ChatMessage {
	const [self, ...parents] = withEmbeddedParents(message);
	for (const parent of parents) store.remember(parent);
	store.observe(self);
	return self;
}

export interface DiscordApi {
	message(channelId: bigint, id: bigint): Promise<DiscordMessageLike | undefined>;

	before?(
		channelId: bigint,
		before: bigint,
		limit: number,
	): Promise<readonly DiscordMessageLike[]>;
}

export function createDiscordSource(name: string, priority: number, api: DiscordApi): MessageSource {
	const { before } = api;

	return {
		name,
		priority,
		async get(channelId, id) {
			const raw = await api.message(channelId, id);
			return raw?.id === id ? withEmbeddedParents(raw) : [];
		},
		before: before
			? async (channelId, limitId, limit) =>
				(await before(channelId, limitId, limit)).map(toChatMessage)
			: undefined,
	};
}
