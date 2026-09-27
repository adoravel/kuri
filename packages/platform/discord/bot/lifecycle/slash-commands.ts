/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { encodeHex } from "@std/encoding/hex";
import type { Repositories } from "@kuristina/database";
import { config } from "@kuristina/config";
import type { DiscordBot } from "../factory.ts";
import { getRegisteredSlashCommands } from "@kuristina/commands/core";

const STATE_KEY = "slash_commands_hash";

async function hash(payload: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(payload));
	return encodeHex(await crypto.subtle.digest("SHA-256", bytes));
}

function generateOAuth2Url(clientId: bigint): string {
	const permissions = 0n;
	return `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=${permissions}`;
}

export async function reconcileSlashCommands(
	bot: DiscordBot,
	repositories: Repositories,
): Promise<void> {
	const payload = getRegisteredSlashCommands().map((c) => c.registration);
	const currentHash = await hash(payload);

	const stored = await repositories.state.get(STATE_KEY);
	if (stored.ok && stored.value === currentHash) {
		logger.info("slash: definitions unchanged, skipping sync");
		return;
	}

	try {
		const devGuildId = config.commands.devGuildId;

		if (devGuildId) {
			await bot.helpers.upsertGuildApplicationCommands(devGuildId, payload);
			logger.yay(`slash: synced ${payload.length} commands to dev guild ${devGuildId}`);
		} else {
			await bot.helpers.upsertGlobalApplicationCommands(payload);
			logger.yay(`slash: synced ${payload.length} commands globally`);
		}
		await repositories.state.set(STATE_KEY, currentHash);
	} catch (e) {
		const error = e as { status?: number; code?: number; message?: string };
		if (error.status === 403 && error.code === 50001) {
			const clientId = config.discord.applicationId;
			const url = generateOAuth2Url(clientId);
			return logger.boo(
				`slash: missing "applications.commands" scope. re-invite the bot with:\n${url}`,
			);
		}
		logger.boo("slash: failed to sync commands:", e);
	}
}
