/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { RICHLINK_KIND_PREFIX, type RichLinkProvider } from "@kuristina/database";
import type { Services } from "../services.ts";
import { createRichLinkHandlers } from "./handlers.ts";
import { reconcileProvider } from "./reconciler.ts";
import type { RichLinkPlatform, SourceMessage } from "./types.ts";

export * from "./types.ts";
export * from "./handlers.ts";
export * from "./reconciler.ts";

export interface RichLinkService {
	handle(message: SourceMessage, signal?: AbortSignal): Promise<void>;
}

export function createRichLinkService(
	services: Services,
	platform: RichLinkPlatform,
): RichLinkService {
	const handlers = createRichLinkHandlers(services);
	const companions = services.repos.messageCompanions;

	return {
		async handle(message, signal) {
			if (!message.guildId || !handlers.length) return;

			const found = handlers
				.map((handler) => ({ provider: handler.provider, items: handler.items(message.content) }))
				.filter(({ items }) => items.length > 0);

			const stored = await companions.getForSourceByPrefix(message.id, RICHLINK_KIND_PREFIX);
			const existing = stored.ok ? stored.value : [];

			if (!found.length && !existing.length) return;
			if (!await platform.canEmbed(message.guildId, message.channelId)) return;

			const pending = new Map(found.map(($) => [$.provider, $.items]));
			for (const companion of existing) {
				const provider = companion.kind.slice(RICHLINK_KIND_PREFIX.length) as RichLinkProvider;
				if (!pending.has(provider)) pending.set(provider, []);
			}

			const outcomes = await Promise.all(
				[...pending].map(([provider, items]) =>
					reconcileProvider(services.repos, platform, message, provider, items, existing, signal)
				),
			);

			if (outcomes.some(Boolean)) await platform.suppressEmbeds(message);
		},
	};
}
