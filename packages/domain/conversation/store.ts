/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { LruTtlCache, SingleFlight } from "@kuristina/core";
import type {
	ChatMessage,
	ConversationStore,
	MessageSource,
	NearbyOptions,
	Thread,
	ThreadOptions,
} from "./types.ts";

export interface ConversationStoreOptions {
	/** only messages from these channels are kept as recent history */
	readonly tracked: (channelId: bigint) => boolean;
	/** upper bound on cached messages */
	readonly maxMessages: number;
	readonly ttlMs: number;
	/** how many message ids to remember per channel for "what was said just before" */
	readonly recentPerChannel: number;
}

const NOT_FOUND_TTL_MS = 5 * 60_000;
const NOT_FOUND_MAX_ENTRIES = 512;

const BACKFILL_MAX = 100;

/** Inserts into an ascending list of ids, ignoring duplicates. Ids are snowflakes, so ascending = chronological. */
function insertSorted(ids: bigint[], id: bigint): void {
	let low = 0, high = ids.length;
	while (low < high) {
		const mid = Math.floor((low + high) / 2);
		if (ids[mid] < id) low = mid + 1;
		else high = mid;
	}
	if (ids[low] !== id) ids.splice(low, 0, id);
}

export function createConversationStore(options: ConversationStoreOptions): ConversationStore {
	const messages = new LruTtlCache<bigint, ChatMessage>({
		maxEntries: options.maxMessages,
		ttlMs: options.ttlMs,
	});
	const notFound = new LruTtlCache<bigint, true>({
		maxEntries: NOT_FOUND_MAX_ENTRIES,
		ttlMs: NOT_FOUND_TTL_MS,
	});

	const recent = new Map<bigint, bigint[]>();
	const backfilled = new Set<bigint>();
	const fetching = new SingleFlight<bigint, ChatMessage | undefined>();
	const sources: MessageSource[] = [];

	const remember = (message: ChatMessage): void => {
		messages.set(message.id, message);
		notFound.delete(message.id);
	};

	const observe = (message: ChatMessage): void => {
		if (!options.tracked(message.channelId)) return;
		remember(message);

		const ids = recent.get(message.channelId) ?? [];
		insertSorted(ids, message.id);
		if (ids.length > options.recentPerChannel) ids.splice(0, ids.length - options.recentPerChannel);
		recent.set(message.channelId, ids);
	};

	const fetchOne = (channelId: bigint, id: bigint): Promise<ChatMessage | undefined> =>
		fetching.run(id, async () => {
			let answered = false;

			for (const source of sources) {
				try {
					const got = await source.get(channelId, id);
					answered = true;

					for (const message of got) remember(message);

					const wanted = got.find((message) => message.id === id);
					if (wanted) return wanted;
				} catch { /* try the next one */ }
			}

			if (answered) notFound.set(id, true);
			return undefined;
		});

	const thread = async (from: ChatMessage, opts: ThreadOptions): Promise<Thread> => {
		const chain: ChatMessage[] = [];
		const seen = new Set<bigint>([from.id]);
		let cacheHits = 0, fetches = 0;

		let nextId = from.replyToId;
		let nextChannel = from.replyToChannelId ?? from.channelId;

		while (nextId !== undefined && chain.length < opts.maxDepth && !seen.has(nextId)) {
			let message = messages.get(nextId);

			if (message) {
				cacheHits++;
			} else {
				if (opts.signal?.aborted || notFound.has(nextId) || fetches >= opts.maxFetches) break;

				fetches++;
				message = await fetchOne(nextChannel, nextId);
				if (!message) break;
			}

			seen.add(message.id);
			chain.push(message);
			nextId = message.replyToId;
			nextChannel = message.replyToChannelId ?? message.channelId;
		}

		return { chain, cacheHits, fetches };
	};

	const before = (channelId: bigint, limitId: bigint, opts: NearbyOptions): ChatMessage[] => {
		const found: ChatMessage[] = [];
		for (const id of recent.get(channelId) ?? []) {
			if (id >= limitId || opts.exclude?.has(id)) continue;

			const message = messages.peek(id);
			if (message) found.push(message);
		}
		return found.slice(-opts.limit);
	};

	const nearby = async (
		channelId: bigint,
		limitId: bigint,
		opts: NearbyOptions,
	): Promise<ChatMessage[]> => {
		const cached = before(channelId, limitId, opts);
		if (cached.length >= opts.limit || backfilled.has(channelId)) return cached;

		backfilled.add(channelId);
		const source = sources.find((s) => s.before);
		if (!source?.before) return cached;

		try {
			const wanted = Math.min(BACKFILL_MAX, opts.limit * 2);
			for (const message of await source.before(channelId, limitId, wanted)) observe(message);
		} catch { /* no-op */ }

		return before(channelId, limitId, opts);
	};

	return {
		addSource(source) {
			sources.push(source);
			sources.sort((a, b) => a.priority - b.priority);
		},
		observe,
		remember,
		peek: (id) => messages.peek(id),
		thread,
		nearby,
	};
}
