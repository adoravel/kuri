/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { StateRepository } from "./state.ts";

const STATE_KEY = "pending_restart";

export interface PendingRestart {
	channelId: bigint;
	messageId: bigint;
}

export function markPendingRestart(
	state: StateRepository,
	channelId: bigint,
	messageId: bigint,
): Promise<unknown> {
	return state.set(
		STATE_KEY,
		JSON.stringify({ channelId: channelId.toString(), messageId: messageId.toString() }),
	);
}

export async function takePendingRestart(state: StateRepository): Promise<PendingRestart | null> {
	const stored = await state.get(STATE_KEY);
	if (!stored.ok || !stored.value) return null;

	await state.delete(STATE_KEY);

	try {
		const { channelId, messageId } = JSON.parse(stored.value) as {
			channelId: string;
			messageId: string;
		};
		return { channelId: BigInt(channelId), messageId: BigInt(messageId) };
	} catch {
		return null;
	}
}
