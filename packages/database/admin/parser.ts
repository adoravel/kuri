/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { err, ok, type Result } from "@kuristina/core";
import { MAX_KEY_VALUE_PAIRS } from "./constants.ts";

export type ParseKeyValueResult = Result<Record<string, string>, string>;

export function parseKeyValuePairs(input: string): ParseKeyValueResult {
	const result: Record<string, string> = {};
	let current = "";
	let key = "";
	let quoteChar: string | null = null;
	let escaped = false;
	let pairs = 0;

	if (input.length === 0) {
		return err("Input is empty");
	}

	for (let i = 0; i < input.length && pairs < MAX_KEY_VALUE_PAIRS; i++) {
		const char = input[i];

		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}

		if (char === "\\") {
			escaped = true;
			continue;
		}

		if (char === '"' || char === "'") {
			if (quoteChar === null) {
				quoteChar = char;
			} else if (char === quoteChar) {
				quoteChar = null;
			} else {
				current += char;
			}
			continue;
		}

		if (quoteChar === null) {
			if (char === "=" && !key) {
				key = current.trim();
				if (!key) {
					return err("Empty key before '='");
				}
				current = "";
				continue;
			}

			if (char === ",") {
				if (key) {
					result[key] = current.trim();
					key = "";
					current = "";
					pairs++;
				}
				continue;
			}
		}

		current += char;
	}

	if (key) {
		result[key] = current.trim();
	}

	if (!Object.keys(result).length) {
		return err("No valid key=value pairs found");
	}

	return ok(result);
}
