/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { encodeBase64 } from "@std/encoding/base64";
import { encodeHex } from "@std/encoding/hex";
import type { Repositories } from "@kuristina/database";
import {
	type IconManifestEntry,
	planIconReconciliation,
	registeredIcons,
	setIconManifest,
	VENDORED_ICONS_DIR,
} from "@kuristina/discord-ui";
import type { DiscordBot } from "../factory.ts";

async function hash(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
	return encodeHex(await crypto.subtle.digest("SHA-256", bytes));
}

async function loadVendored() {
	const out: { key: string; bytes: Uint8Array<ArrayBuffer>; hash: string }[] = [];
	for (const key of Object.keys(registeredIcons)) {
		try {
			const bytes = await Deno.readFile(new URL(`${key}.png`, VENDORED_ICONS_DIR));
			out.push({ key, bytes, hash: await hash(bytes) });
		} catch { /* no-op */ }
	}
	return out;
}

export async function reconcileIcons(
	bot: DiscordBot,
	repositories: Repositories,
): Promise<void> {
	const existing = await repositories.icon.getAll();
	if (!existing.ok) {
		logger.boo("icons: failed to read icon_emojis:", existing.error);
		return;
	}

	let remoteEmojis;
	try {
		remoteEmojis = (await bot.helpers.getApplicationEmojis()).items.map((e) => ({
			id: e.id!,
			name: e.name,
			animated: e.animated,
		}));
	} catch (e) {
		logger.boo("icons: failed to list application emojis:", e);
		return;
	}

	const vendored = await loadVendored();
	const { actions, skippedNoVendoredAsset } = planIconReconciliation(
		vendored,
		existing.value,
		remoteEmojis,
	);

	for (const key of skippedNoVendoredAsset) {
		logger.boo(`icons: no vendored PNG for "${key}", skipping`);
	}

	const manifest: Record<string, IconManifestEntry> = {};

	for (const action of actions) {
		if (action.kind === "keep") {
			manifest[action.key] = action.entry;
			continue;
		}

		if (action.kind === "delete_orphan") {
			try {
				await bot.helpers.deleteApplicationEmoji(action.remote.id);
				logger.yay(`icons: deleted orphaned "${action.remote.name}" (${action.remote.id})`);
			} catch (e) {
				logger.boo(`icons: failed to delete orphaned "${action.remote.name}":`, e);
			}
			continue;
		}

		const { key, name, bytes, hash: sourceHash, replacing } = action;

		if (replacing) {
			try {
				await bot.helpers.deleteApplicationEmoji(replacing.id);
				logger.yay(`icons: deleted old "${key}" (${replacing.id})`);
			} catch (e) {
				logger.boo(`icons: failed to delete old "${key}":`, e);
				continue;
			}
		}

		try {
			const image = `data:image/png;base64,${encodeBase64(bytes)}`;
			const emoji = await bot.helpers.createApplicationEmoji({ name, image });
			await repositories.icon.upsert(key, emoji.id!.toString(), !!emoji.animated, sourceHash);
			manifest[key] = { id: emoji.id!, animated: !!emoji.animated };
			logger.yay(`icons: uploaded "${key}" as "${name}" -> ${emoji.id}`);
		} catch (e) {
			logger.boo(`icons: failed to upload "${key}":`, e);
		}
	}

	setIconManifest(manifest);
}
