/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Database } from "../connection.ts";
import { MarkovRepository } from "./markov.ts";
import { ScrobbleAccountRepository } from "./scrobble.ts";
import { IconRepository } from "./icon.ts";
import { StateRepository } from "./state.ts";
import { GuildMemberRepository } from "./members.ts";
import { JsonCacheRepository } from "./json_cache.ts";
import { MessageCompanionRepository } from "./message_companions.ts";
import { GuildProfileRepository } from "./guild_profile.ts";
import { ArtistAliasRepository } from "./artist_alias.ts";

export function createRepositories(db: Database) {
	return {
		markov: new MarkovRepository(db),
		scrobble: new ScrobbleAccountRepository(db),
		icon: new IconRepository(db),
		state: new StateRepository(db),
		members: new GuildMemberRepository(db),
		cache: new JsonCacheRepository(db, "external_cache"),
		lastfmCache: new JsonCacheRepository(db, "lastfm_response_cache"),
		messageCompanions: new MessageCompanionRepository(db),
		guildProfile: new GuildProfileRepository(db),
		artistAliases: new ArtistAliasRepository(db),
	};
}

export type Repositories = ReturnType<typeof createRepositories>;

export * from "./helper.ts";
export * from "./json_cache.ts";
export * from "./markov.ts";
export * from "./scrobble.ts";
export * from "./icon.ts";
export * from "./state.ts";
export * from "./members.ts";
export * from "./message_companions.ts";
export * from "./guild_profile.ts";
export * from "./artist_alias.ts";
export * from "./restart_state.ts";
