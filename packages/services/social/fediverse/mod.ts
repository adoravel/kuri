/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { fetchFediPost } from "./client.ts";
import { extractFediUrls, parseFediUrl } from "./extractor.ts";

export * from "./types.ts";
export * from "./extractor.ts";
export * from "./client.ts";

export function createFediverseService() {
	return { fetch: fetchFediPost, extractUrls: extractFediUrls, parseUrl: parseFediUrl };
}
export type FediverseService = ReturnType<typeof createFediverseService>;
