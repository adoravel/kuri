/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getConfig } from "./loader.ts";
import { field, type Infer } from "./schema.ts";

export const configSchema = {
	discord: {
		token: field.string(),
		applicationId: field.snowflake(),
		guildId: field.snowflake(),
		client: {
			token: field.stringOr(""),
			applicationId: field.snowflakeOr(0n),
		},
	},
	owner: {
		id: field.snowflake(),
	},
	sqlite: {
		path: field.stringOr("~/.kuristina/data/kuristina.sqlite"),
		maintenanceIntervalMs: field.positiveInt(6 * 60 * 60 * 1000),
		companionRetentionSeconds: field.positiveInt(30 * 60),
		musicLinkCacheTtlSeconds: field.positiveInt(31 * 24 * 60 * 60),
	},
	commands: {
		defaultCooldownMs: field.positiveInt(3_000),
		maxMentions: field.positiveInt(5),
		devGuildId: field.snowflakeOr(0n),
	},
	network: {
		userAgent: field.stringOr("kuristina/0.1.0 (+https://kyu.re/~kuristina)"),
	},
	cache: {
		contextTtlMs: field.positiveInt(45_000),
	},
	presence: {
		reconcileIntervalMs: field.positiveInt(6 * 60 * 60 * 1000),
	},
	modules: {
		commands: field.record(field.boolean(false)),
		markov: {
			pattern: field.regex(/\bmarkov\b/ig),
			enabled: field.boolean(false),
			channelIds: field.snowflakeArray(),
			maxGenerationLength: field.positiveInt(420),
			cooldownMs: field.positiveInt(1_000),
			channelCooldowns: field.record(field.positiveInt(1_000)),
			triggerThreshold: {
				min: field.positiveInt(9),
				max: field.positiveInt(32),
			},
			singleWordChance: field.positiveInt(12),
			urlConcatChance: field.positiveInt(165),
			urlOnlyChance: field.positiveInt(330),
			replacements: field.record(field.stringOr("")),
			serverReplacements: field.record(field.record(field.stringOr(""))),
			translationEmoji: field.stringOr("❔"),
			guide: {
				enabled: field.boolean(false),
				apiKey: field.stringOr(""),
				maxCalls: field.positiveInt(16),
				interjectionCalls: field.positiveInt(10),
				chunkSize: field.positiveInt(4),
				optionsPerStep: field.positiveInt(6),
				sharpness: field.positiveInt(2),
				timeoutMs: field.positiveInt(5_000),
			},
			context: {
				enabled: field.boolean(false),
				maxDepth: field.positiveInt(15),
				maxFetches: field.positiveInt(5),
				nearbyMessages: field.positiveInt(9),
				contextChars: field.positiveInt(2_400),
				messageChars: field.positiveInt(200),
				maxMessages: field.positiveInt(5_000),
				cacheTtlMs: field.positiveInt(48 * 60 * 60 * 1000),
			},
		},
		deepl: {
			enabled: field.boolean(false),
			baseUrl: field.stringOr("https://api-free.deepl.com/v2"),
			apiKey: field.stringOr(""),
		},
		lastfm: {
			enabled: field.boolean(false),
			baseUrl: field.stringOr("https://ws.audioscrobbler.com/2.0/"),
			apiKey: field.stringOr(""),
			secret: field.stringOr(""),
			cacheTtlSeconds: field.positiveInt(12 * 60 * 60),
		},
		linkEmbeds: {
			github: field.boolean(true),
			bluesky: field.boolean(true),
			forgejo: field.boolean(true),
			forgejoInstances: field.stringOr("codeberg.org"),
			twitter: field.boolean(true),
			fediverse: field.boolean(true),
			maxPerMessage: field.positiveInt(3),
		},
	},
	design: {
		colours: {
			primary: field.colourOr(0xb74139),
			success: field.colourOr(0x57f287),
			danger: field.colourOr(0xed4245),
			info: field.colourOr(0x5865f2),
		},
		emojis: {
			success: field.stringOr("✅"),
			error: field.stringOr("❌"),
			loading: field.stringOr("⏳"),
			wordmark: field.stringOr(""),
		},
		branding: {
			name: field.stringOr("kuristina"),
			repoUrl: field.stringOr("https://kyu.re/~kuristina"),
			licenseName: field.stringOr("GNU Affero General Public License v3.0"),
			licenseUrl: field.stringOr("https://spdx.org/licenses/AGPL-3.0-or-later.html"),
		},
	},
};

export type KuristinaConfig = Infer<typeof configSchema>;

export const config: Readonly<ReturnType<typeof getConfig>> = new Proxy({} as any, {
	get(_, prop) {
		return Reflect.get(getConfig(), prop);
	},
});

export * from "./loader.ts";
export * from "./errors.ts";
export * from "./schema.ts";
