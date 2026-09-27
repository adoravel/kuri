/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export async function mapWithConcurrency<T, R>(
	items: readonly T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
	signal?: AbortSignal,
): Promise<PromiseSettledResult<R>[]> {
	if (limit < 1) throw new RangeError("limit must be at least one");
	if (items.length === 0) return [];

	const results: PromiseSettledResult<R>[] = new Array(items.length);
	let cursor = 0;

	async function worker() {
		while (cursor < items.length) {
			const index = cursor++;

			if (signal?.aborted) {
				results[index] = {
					status: "rejected",
					reason: signal.reason ?? new DOMException("Aborted", "AbortError"),
				};
				continue;
			}

			try {
				const value = await fn(items[index], index);
				results[index] = { status: "fulfilled", value };
			} catch (reason) {
				results[index] = { status: "rejected", reason };
			}
		}
	}

	const workers: Promise<void>[] = [];
	const count = Math.min(limit, items.length);

	for (let i = 0; i < count; i++) {
		workers.push(worker());
	}

	await Promise.all(workers);
	return results;
}
