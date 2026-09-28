/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CacheStore } from "@kuristina/core";
import type { Database, Repositories } from "@kuristina/database";
import type { LastFmService } from "@kuristina/services/music/last.fm";
import type { BlueskyService, TwitterService } from "@kuristina/services/social/fx";
import type { FediverseService } from "@kuristina/services/social/fediverse";
import type { GitHubService } from "@kuristina/services/forges/github";
import type { ForgejoService } from "@kuristina/services/forges/forgejo";
import type { MusicLinksService } from "@kuristina/services/music/links";
import type { MetadataService } from "@kuristina/services/music/metadata";
import type { KuristinaConfig } from "@kuristina/config";
import type { ScrobbleProvider } from "@kuristina/domain/scrobbling";
import type { ConversationStore } from "@kuristina/domain/conversation";

export interface Services {
	config: KuristinaConfig;
	db: Database;
	repos: Repositories;
	cache: CacheStore;
	lastfm: LastFmService;
	scrobbling: ScrobbleProvider;
	twitter: TwitterService;
	bluesky: BlueskyService;
	fediverse: FediverseService;
	github: GitHubService;
	forgejo: ForgejoService;
	musicLinks: MusicLinksService;
	metadata: MetadataService;
	conversation: ConversationStore;
}
