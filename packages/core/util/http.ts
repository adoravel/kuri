/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type RetryOptions, withRetry } from "./retry.ts";
import { Errors, type NetworkError } from "../errors.ts";
import { err, ok, type Result } from "../lib/result.ts";

export interface FetchOptions<E = NetworkError> extends RequestInit {
	retry?: RetryOptions;
	mapError?: (e: unknown, status?: number, body?: string) => E;
}

const defaultMapError = (e: unknown): NetworkError =>
	Errors.network(e instanceof Error ? e.message : String(e));

export async function fetchWithRetry<T, E = NetworkError>(
	input: RequestInfo | URL,
	init?: FetchOptions<E | NetworkError> & { json?: boolean },
): Promise<Result<T, E | NetworkError>> {
	const { retry, mapError = defaultMapError, json = true, ...fetchInit } = init ?? {};
	try {
		const response = await withRetry(
			() => fetch(input, fetchInit),
			retry ?? { maxAttempts: 3, baseDelayMs: 500 },
		);

		const text = await response.text();
		if (!response.ok) {
			const mapped = mapError(new Error(`HTTP ${response.status}`), response.status, text);
			return err(mapped);
		}

		try {
			return ok(JSON.parse(text) as T);
		} catch {
			if (json) {
				return err(
					Errors.network(`Invalid JSON response: ${JSON.stringify(text, null, 4)}}`),
				) as Result<T, E | NetworkError>;
			}
			return ok(text as T);
		}
	} catch (e) {
		return err(mapError(e));
	}
}
