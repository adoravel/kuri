/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { parse as parseToml } from "@std/toml";
import { err, ok, type Result } from "@kuristina/core";
import { type ConfigError, Errors, type FieldError } from "./errors.ts";
import { parseSchema } from "./schema.ts";
import { configSchema, type KuristinaConfig } from "./mod.ts";

export const DEFAULT_CONFIG_PATH = "config.toml";

function overrideFromEnv(raw: Record<string, unknown>, path: string = ""): void {
	for (const [key, value] of Object.entries(raw)) {
		const fullPath = path ? `${path}.${key}` : key;
		const envKey = fullPath.toUpperCase().replace(/\./g, "_");
		const envVal = Deno.env.get(envKey);
		if (envVal !== undefined && typeof value === "string") {
			raw[key] = envVal;
		} else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			overrideFromEnv(value as Record<string, unknown>, fullPath);
		}
	}
}

export function loadConfig(path = DEFAULT_CONFIG_PATH): Result<KuristinaConfig, ConfigError> {
	let text: string;
	try {
		text = Deno.readTextFileSync(path);
	} catch (e) {
		if (e instanceof Deno.errors.NotFound) return err(Errors.notFound(path));
		if (e instanceof Deno.errors.PermissionDenied) return err(Errors.permissionDenied(path));
		return err(Errors.parseFailed(path, e instanceof Error ? e.message : String(e)));
	}

	let raw: Record<string, unknown>;
	try {
		raw = parseToml(text) as Record<string, unknown>;
	} catch (e) {
		return err(Errors.parseFailed(path, e instanceof Error ? e.message : String(e)));
	}

	overrideFromEnv(raw);

	const errors: FieldError[] = [];
	const config = parseSchema(configSchema, raw, "", errors);
	if (errors.length) return err(Errors.invalid(errors));

	return ok(config);
}

export function requireConfig(path = DEFAULT_CONFIG_PATH): KuristinaConfig {
	const result = loadConfig(path);
	if (!result.ok) {
		logger.boo(`\nfailed to load config:\n  ${result.error.message}\n`);
		Deno.exit(1);
	}
	return result.value;
}

let backing: KuristinaConfig;

export const getConfig = () => backing ??= requireConfig();

export function cfg(path: string): boolean {
	const keys = path.split(".");
	let node: unknown = getConfig().modules;

	for (const key of keys) {
		if (node === null || typeof node !== "object") return false;
		node = (node as Record<string, unknown>)[key];
	}

	// allow cfg("modules.markov") as shorthand for cfg("modules.markov.enabled")
	if (node !== null && typeof node === "object") {
		node = (node as Record<string, unknown>)["enabled"];
	}

	return node === true;
}

export function hasClientAccount(): boolean {
	return getConfig().discord.client.token.length > 0;
}
