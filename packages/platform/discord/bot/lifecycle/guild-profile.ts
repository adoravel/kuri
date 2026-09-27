/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { encodeHex } from "@std/encoding/hex";
import { fetchWithRetry } from "@kuristina/core";
import type { Repositories } from "@kuristina/database";
import { config } from "@kuristina/config";

interface GuildProfilePayload {
	readonly display_name_colors: readonly number[];
	readonly display_name_effect_id: number;
	readonly display_name_font_id: number;
	readonly bio: string;
}

function buildPayload(): GuildProfilePayload | undefined {
	// todo: configurable
	const botProfile = {
		enabled: true,
		displayNameColors: [0xFF6361, 0xFFA600, 0x60A86F, 0x0086C4, 0x8E1CB3],
		displayNameEffectId: 2,
		displayNameFontId: 3,
	};
	if (!botProfile.enabled) return undefined;
	return {
		display_name_colors: botProfile.displayNameColors,
		display_name_effect_id: botProfile.displayNameEffectId,
		display_name_font_id: botProfile.displayNameFontId,
		bio: "",
	};
}

async function hash(payload: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(payload));
	return encodeHex(await crypto.subtle.digest("SHA-256", bytes));
}

export async function syncGuildProfile(
	repositories: Repositories,
	guildId: bigint,
): Promise<void> {
	const payload = buildPayload();
	if (!payload) return;

	const currentHash = await hash(payload);

	const stored = await repositories.guildProfile.getHash(guildId);
	if (stored.ok && stored.value === currentHash) return;

	const response = await fetchWithRetry(
		`https://discord.com/api/v9/guilds/${guildId}/members/@me`,
		{
			method: "PATCH",
			body: JSON.stringify(payload),
			headers: {
				Authorization: `Bot ${config.discord.token}`,
				"Content-Type": "application/json",
			},
			retry: { maxAttempts: 2, baseDelayMs: 750 },
		},
	);

	if (!response.ok) {
		logger.boo(`profile: failed to sync guild ${guildId}:`, response.error);
		return;
	}

	const persisted = await repositories.guildProfile.setHash(guildId, currentHash);
	if (!persisted.ok) {
		logger.boo(
			`profile: synced guild ${guildId} but failed to persist hash:`,
			persisted.error,
		);
		return;
	}

	logger.info(`profile: synced guild ${guildId}`);
}
