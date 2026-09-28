/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

interface Slot<V> {
	value: V;
	expiresAt: number;
}

export interface LruTtlOptions {
	readonly maxEntries: number;
	readonly ttlMs: number;
}
export class LruTtlCache<K, V> {
	readonly #slots = new Map<K, Slot<V>>();
	readonly #maxEntries: number;
	readonly #ttlMs: number;

	constructor({ maxEntries, ttlMs }: LruTtlOptions) {
		if (maxEntries < 1) throw new RangeError("maxEntries must be at least 1");
		this.#maxEntries = maxEntries;
		this.#ttlMs = ttlMs;
	}

	get size(): number {
		return this.#slots.size;
	}

	get(key: K): V | undefined {
		const slot = this.#live(key);
		if (!slot) return undefined;

		this.#slots.delete(key);
		this.#slots.set(key, slot);
		return slot.value;
	}

	peek(key: K): V | undefined {
		return this.#live(key)?.value;
	}

	has(key: K): boolean {
		return this.#live(key) !== undefined;
	}

	set(key: K, value: V, ttlMs: number = this.#ttlMs): this {
		this.#slots.delete(key);
		this.#slots.set(key, { value, expiresAt: Date.now() + ttlMs });

		if (this.#slots.size > this.#maxEntries) {
			const oldest = this.#slots.keys().next();
			if (!oldest.done) this.#slots.delete(oldest.value);
		}
		return this;
	}

	delete(key: K): boolean {
		return this.#slots.delete(key);
	}

	clear(): void {
		this.#slots.clear();
	}

	sweep(now: number = Date.now()): number {
		let dropped = 0;
		for (const [key, slot] of this.#slots) {
			if (slot.expiresAt <= now) {
				this.#slots.delete(key);
				dropped++;
			}
		}
		return dropped;
	}

	#live(key: K): Slot<V> | undefined {
		const slot = this.#slots.get(key);
		if (!slot) return undefined;

		if (slot.expiresAt <= Date.now()) {
			this.#slots.delete(key);
			return undefined;
		}
		return slot;
	}
}

export class SingleFlight<K, V> {
	readonly #inflight = new Map<K, Promise<V>>();

	run(key: K, job: () => Promise<V>): Promise<V> {
		const running = this.#inflight.get(key);
		if (running) return running;

		const promise = job().finally(() => this.#inflight.delete(key));
		this.#inflight.set(key, promise);
		return promise;
	}
}
