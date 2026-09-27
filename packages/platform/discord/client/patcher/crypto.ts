/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export function generateUUID(): string {
	return crypto.randomUUID();
}

export function generateLaunchSignature(): string {
	const MASK = 0xff7fefeff7eff7ffdf7effbffefff7ffn;
	const bytes = crypto.getRandomValues(new Uint8Array(16));

	const view = new DataView(bytes.buffer);
	const uuidInt = (view.getBigInt64(0) << 64n) | view.getBigInt64(8);

	const cleared = uuidInt & MASK;
	const hex = cleared.toString(16).padStart(32, "0");

	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${
		hex.slice(20, 32)
	}`;
}
