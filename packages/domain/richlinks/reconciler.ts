/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { mapWithConcurrency } from "@kuristina/core";
import type {
	CompanionKind,
	MessageCompanion,
	Repositories,
	RichLinkProvider,
} from "@kuristina/database";
import type { LinkItem, RichLinkPlatform, SourceMessage } from "./types.ts";

const RENDER_CONCURRENCY = 5;

export async function reconcileProvider(
	repositories: Repositories,
	platform: RichLinkPlatform,
	message: SourceMessage,
	provider: RichLinkProvider,
	items: readonly LinkItem[],
	existing: readonly MessageCompanion[],
	signal?: AbortSignal,
): Promise<boolean> {
	const kind: CompanionKind = `richlink:${provider}`;
	const companions = repositories.messageCompanions;
	const mine = existing.filter((c) => c.kind === kind);

	const keys = new Set(items.map((item) => item.key));
	const known = new Set(mine.map((c) => c.sourceUrl).filter((url): url is string => url !== null));

	const stale = mine.filter((c) => c.sourceUrl && !keys.has(c.sourceUrl));
	if (stale.length) {
		await companions.deleteResponses(message.id, stale.map((c) => c.responseMessageId));
		await Promise.all(
			stale.map((c) => platform.deleteMessage(c.channelId, c.responseMessageId).catch(() => {})),
		);
	}

	const kept = mine.length - stale.length;
	if (signal?.aborted) return kept > 0;

	const pending = items.filter((item) => !known.has(item.key));
	if (!pending.length) return kept > 0;

	const rendered = await mapWithConcurrency(pending, RENDER_CONCURRENCY, async (item) => {
		const payload = await item.render(signal);
		if (!payload) return false;

		const sent = await platform.sendReply(message, payload);
		await companions.add(message.id, sent.id, message.channelId, kind, item.key);
		return true;
	}, signal);

	const sent = rendered.filter((r) => r.status === "fulfilled" && r.value).length;
	return kept + sent > 0;
}
