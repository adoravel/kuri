/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface ChatMessage {
	readonly id: bigint;
	readonly channelId: bigint;
	readonly authorId: bigint;
	readonly authorName: string;
	readonly text: string;
	/** The message this one replies to, if any. */
	readonly replyToId?: bigint;
	readonly replyToChannelId?: bigint;
}

export interface MessageSource {
	readonly name: string;
	readonly priority: number;

	/** resolves to an empty array when it can't be found; rejects on transport errors. */
	get(channelId: bigint, id: bigint): Promise<readonly ChatMessage[]>;

	/** messages posted right before `before`, in any order */
	before?(channelId: bigint, before: bigint, limit: number): Promise<readonly ChatMessage[]>;
}

export interface Thread {
	/** ancestors of the starting message, nearest first */
	readonly chain: readonly ChatMessage[];
	readonly cacheHits: number;
	/** requests sent to message sources (each may have delivered several ancestors) */
	readonly fetches: number;
}

export interface ThreadOptions {
	readonly maxDepth: number;
	readonly maxFetches: number;
	readonly signal?: AbortSignal;
}

export interface NearbyOptions {
	readonly limit: number;
	/** message ids to leave out, e.g. the ones already in the reply thread */
	readonly exclude?: ReadonlySet<bigint>;
}

export interface ConversationStore {
	/** registers a place to fetch cache misses from */
	addSource(source: MessageSource): void;

	/** a message seen live. cached and added to its channel's recent history */
	observe(message: ChatMessage): void;

	/** a message known only as somebody's ancestor */
	remember(message: ChatMessage): void;

	peek(id: bigint): ChatMessage | undefined;

	/** walks the reply chain upwards */
	thread(from: ChatMessage, options: ThreadOptions): Promise<Thread>;

	/** The messages that came just before `before` in a channel */
	nearby(channelId: bigint, before: bigint, options: NearbyOptions): Promise<ChatMessage[]>;
}
