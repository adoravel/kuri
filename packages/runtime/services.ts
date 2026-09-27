/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { KuristinaConfig } from "@kuristina/config";
import { createRepositories, type Database, toCacheStore } from "@kuristina/database";
import type { Services } from "@kuristina/domain/services";
import { createScrobbleProvider } from "@kuristina/domain/scrobbling";
import { createLastFmService } from "@kuristina/services/music/last.fm";
import { createBlueskyService, createTwitterService } from "@kuristina/services/social/fx";
import { createFediverseService } from "@kuristina/services/social/fediverse";
import { createGitHubService } from "@kuristina/services/forges/github";
import { createForgejoService } from "@kuristina/services/forges/forgejo";
import { createMusicLinksService } from "@kuristina/services/music/links";
import { createMetadataService } from "@kuristina/services/music/metadata";

export function createServices(config: KuristinaConfig, db: Database): Services {
	const repos = createRepositories(db);
	const cache = toCacheStore(repos.cache);
	const lastfm = createLastFmService(toCacheStore(repos.lastfmCache));

	return {
		config,
		db,
		repos,
		cache,
		lastfm,
		scrobbling: createScrobbleProvider(lastfm),
		twitter: createTwitterService(),
		bluesky: createBlueskyService(),
		fediverse: createFediverseService(),
		github: createGitHubService(cache),
		forgejo: createForgejoService(cache),
		musicLinks: createMusicLinksService(cache),
		metadata: createMetadataService(cache),
	};
}
