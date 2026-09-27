/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export const ADMIN_EDITABLE_TABLES = [
	"markov_chain",
	"markov_words",
	"artist_aliases",
	"artist_alias_groups",
	"music_link_cache",
	"lastfm_response_cache",
	"scrobble_accounts",
] as const;

export const REDACTED_COLUMNS: Readonly<Partial<Record<AdminEditableTable, readonly string[]>>> = {
	scrobble_accounts: ["session_key"],
};

export type AdminEditableTable = typeof ADMIN_EDITABLE_TABLES[number];

export const MAX_HISTORY = 20;
export const MAX_PAGE_SIZE = 50;
export const MAX_KEY_VALUE_PAIRS = 50;
export const MAX_PLAN_ROWS = 500;
export const MAX_DIFF_LENGTH = 1800;
export const CONFIRM_TIMEOUT_MS = 60_000;
