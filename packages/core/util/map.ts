/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface FixedEntry<K, V> {
	key: K;
	value: V;
	expiresAt: number;
}

export class TimedMap<K, V> {
	private readonly cache = new Map<K, FixedEntry<K, V>>();
	private readonly queue: FixedEntry<K, V>[] = [];

	private headIndex = 0;
	private processInterval: ReturnType<typeof setTimeout> | null = null;

	constructor(
		public readonly maxAgeMs: number,
		private readonly intervalMs: number = 1000,
		private readonly onExpire?: (key: K, value: V) => void,
	) {}

	public set(key: K, value: V): this {
		const expiresAt = Date.now() + this.maxAgeMs;

		const entry = { key, value, expiresAt };
		this.cache.set(key, entry);
		this.queue.push(entry);

		this.startInterval();
		return this;
	}

	public get(key: K): V | undefined {
		const entry = this.cache.get(key);
		if (!entry) return undefined;

		if (Date.now() >= entry.expiresAt) {
			return this.delete(key), undefined;
		}
		return entry.value;
	}

	public getRemainingMs(key: K, now: number): number {
		const entry = this.cache.get(key);
		if (!entry) return 0;

		const remaining = entry.expiresAt - now;
		if (remaining <= 0) {
			this.delete(key);
			return 0;
		}
		return remaining;
	}

	public has(key: K): boolean {
		return this.get(key) !== undefined;
	}

	public delete(key: K): boolean {
		const entry = this.cache.get(key);
		if (!entry) return false;

		this.cache.delete(key);
		this.onExpire?.(entry.key, entry.value);
		return true;
	}

	private cleanupExpired(): void {
		const now = Date.now();

		while (this.headIndex < this.queue.length) {
			const front = this.queue[this.headIndex];
			if (now < front.expiresAt) break;

			this.headIndex++;

			const currentActive = this.cache.get(front.key);
			if (currentActive === front) {
				this.cache.delete(front.key);
				this.onExpire?.(front.key, front.value);
			}
		}

		if (this.headIndex > 500 && this.headIndex > this.queue.length / 2) {
			this.queue.splice(0, this.headIndex);
			this.headIndex = 0;
		}

		if (this.cache.size === 0) this.stopInterval();
	}

	private startInterval(): void {
		if (this.processInterval) return;
		this.processInterval = globalThis.setInterval(() => this.cleanupExpired(), this.intervalMs);
		Deno.unrefTimer(this.processInterval);
	}

	private stopInterval(): void {
		if (this.processInterval === null) return;
		globalThis.clearInterval(this.processInterval);
		this.processInterval = null;
	}

	public clear(): void {
		this.cache.clear();
		this.queue.length = 0;
		this.headIndex = 0;
		this.stopInterval();
	}
}
