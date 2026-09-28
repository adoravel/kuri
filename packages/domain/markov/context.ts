/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ChatMessage, ConversationStore } from "../conversation/mod.ts";
import { log } from "./consumer.ts";
import type { ContextConfig } from "./types.ts";

export interface ChatContext {
	/** the message being answered */
	incoming: string;
	/** reply chain leading to `incoming` */
	thread: string[];
	/** other recent channel messages */
	nearby: string[];
	/** text to mine for opening keywords */
	keywordSources: string[];
}

function fit(lines: string[], budget: number): string[] {
	const kept: string[] = [];
	let used = 0;
	for (const line of lines) {
		if (used + line.length > budget) break;
		kept.push(line);
		used += line.length;
	}
	return kept;
}

export function createChatContext(
	config: ContextConfig,
	conversation: ConversationStore,
	selfId: bigint,
) {
	const clip = (text: string): string =>
		text.length > config.messageChars ? text.slice(0, config.messageChars - 1) + "…" : text;

	const line = (m: ChatMessage): string =>
		`${m.authorId === selfId ? "[bot]" : m.authorName}: ${clip(m.text)}`;

	const build = async (message: ChatMessage, signal?: AbortSignal): Promise<ChatContext> => {
		const { chain, cacheHits, fetches } = await conversation.thread(message, {
			maxDepth: config.maxDepth,
			maxFetches: config.maxFetches,
			signal,
		});

		const nearby = await conversation.nearby(message.channelId, message.id, {
			limit: config.nearbyMessages,
			exclude: new Set(chain.map((m) => m.id)),
		});

		const spoken = (m: ChatMessage): boolean => m.text.length > 0;

		const threadLines = fit(chain.filter(spoken).map(line), config.contextChars * 0.7);
		const used = threadLines.reduce((n, l) => n + l.length, 0);
		const nearbyLines = fit(
			nearby.filter(spoken).reverse().map(line),
			config.contextChars - used,
		);

		log(
			`context: thread=${chain.length} (${threadLines.length} used) ` +
				`nearby=${nearby.length} (${nearbyLines.length} used) ` +
				`cached=${cacheHits} fetched=${fetches}`,
		);

		return {
			incoming: clip(message.text),
			thread: threadLines.reverse(),
			nearby: nearbyLines.reverse(),
			keywordSources: [message.text, ...chain.slice(0, 3).map((m) => m.text)],
		};
	};

	const isReplyToSelf = (message: ChatMessage): boolean =>
		message.replyToId !== undefined &&
		conversation.peek(message.replyToId)?.authorId === selfId;

	return { build, isReplyToSelf };
}

export type ChatContextService = ReturnType<typeof createChatContext>;
