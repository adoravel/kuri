/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { KuristinaConfig } from "@kuristina/config";

export type GuideConfig = KuristinaConfig["modules"]["markov"]["guide"];

export type ContextConfig = KuristinaConfig["modules"]["markov"]["context"];

export interface MarkovPlatform {
	removeUserReaction(
		channelId: bigint,
		messageId: bigint,
		userId: bigint,
		emoji: string,
	): Promise<unknown>;
}

export interface MarkovLink {
	prefix: string;
	suffix: string;
	count: number;
}
 
export interface MarkovConfig {
	pattern: RegExp;
	enabled: boolean;
	channelIds: bigint[];
	maxGenerationLength: number;
	cooldownMs: number;
	channelCooldowns: Record<string, number>;
	triggerThreshold: { min: number; max: number };
	singleWordChance: number;
	urlConcatChance: number;
	urlOnlyChance: number;
	replacements: Record<string, string>;
	serverReplacements: Record<string, Record<string, string>>;
	translationEmoji: string;
	guide?: GuideConfig;
}
 
