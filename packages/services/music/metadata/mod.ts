/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CacheStore } from "@kuristina/core";
import { getMusicMetadata, type MusicMetadataKind } from "./http.ts";

export * from "./http.ts";

export function createMetadataService(cache: CacheStore) {
	return {
		get: (artist: string, title: string, kind: MusicMetadataKind) =>
			getMusicMetadata(cache, artist, title, kind),
	};
}
export type MetadataService = ReturnType<typeof createMetadataService>;
