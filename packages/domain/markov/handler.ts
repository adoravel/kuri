/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { discard, ok, or, type Result, safe } from "@kuristina/core";
import type { AppError } from "@kuristina/errors";

import type { SqlError } from "@kuristina/database";
import { deepl } from "@kuristina/services/translation";
import type { TranslateOptions } from "@kuristina/services/translation/deepl";

import type { DiscordClient, Message, Reaction } from "@kuristina/discord-client";
import { toChatMessage } from "../conversation/mod.ts";
import { applyReplacements } from "./replacements.ts";
import { createMarkovConsumer, log } from "./consumer.ts";
import { keywords } from "./core.ts";
import { createChatContext } from "./context.ts";
import { createGuide } from "./jev.ts";
import type { MarkovConfig, MarkovPlatform } from "./types.ts";
import type { Services } from "../services.ts";

const TRANSLATION_DEBOUNCE_MS = 10_000;

interface ChannelState {
	messageCount: number;
	triggerThreshold: number;
	lastReplyAt: number;
	lastReactionAt: number;
}

const channelStates = new Map<bigint, ChannelState>();
const translationTimestamps = new Map<bigint, number>();

const nextThreshold = ({ triggerThreshold: { min, max } }: MarkovConfig): number =>
	Math.floor(Math.random() * (max - min + 1)) + min;

function getChannelState(config: MarkovConfig, channelId: bigint): ChannelState {
	const existing = channelStates.get(channelId);
	if (existing) return existing;

	const state: ChannelState = {
		messageCount: 0,
		triggerThreshold: nextThreshold(config),
		lastReplyAt: 0,
		lastReactionAt: 0,
	};
	channelStates.set(channelId, state);
	return state;
}

function resetTrigger(config: MarkovConfig, state: ChannelState): void {
	state.messageCount = 0;
	state.triggerThreshold = nextThreshold(config);

	log(`next message in ${state.triggerThreshold} messages`);
}

const getCooldown = (config: MarkovConfig, channelId: bigint): number =>
	config.channelCooldowns[channelId.toString()] ?? config.cooldownMs;

const isTrackedChannel = (config: MarkovConfig, channelId: bigint): boolean =>
	config.channelIds.includes(channelId);

const normalise = (input: string): string =>
	input.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const matches = (input: string, pattern: RegExp): boolean => pattern.test(normalise(input));

export function createMarkovHandler(services: Services, platform: MarkovPlatform) {
	const { config } = services;
	const markov = config.modules.markov;

	const { learn, generate, sampleWord, seedCandidates, generateFrom } = createMarkovConsumer(
		services,
	);

	const chat = markov.context?.enabled
		? createChatContext(markov.context, services.conversation, config.discord.client.applicationId)
		: undefined;

	const generateReply = async (
		message: Message,
		isReplyToBot: boolean,
		signal?: AbortSignal,
	): Promise<Result<string, SqlError>> => {
		const { singleWordChance, guide } = markov;

		if (Math.random() * 100 < singleWordChance) {
			log("generating single word...");
			return await or(sampleWord())(() => generate(undefined, signal));
		}

		if (!guide?.enabled) {
			log("triggering generation...");
			return await generate(undefined, signal);
		}

		log("triggering guided generation...");
		const convo = chat ? await chat.build(toChatMessage(message), signal) : undefined;

		const [head, ...tail] = convo?.keywordSources ?? [message.content];
		const words = [...new Set([...keywords(head, 3), ...keywords(tail.join(" "), 2)])];

		const seeds = await seedCandidates(words, 2);
		if (!seeds.ok) return seeds;
		if (!seeds.value.length) return await generate(undefined, signal);

		const budget = isReplyToBot ? guide.maxCalls : (guide.interjectionCalls ?? guide.maxCalls);
		const jev = createGuide(
			guide.apiKey,
			{
				incoming: convo?.incoming ?? message.content,
				thread: convo?.thread ?? [],
				nearby: convo?.nearby ?? [],
			},
			{ ...guide, maxCalls: budget },
			signal,
		);
		const seed = await jev.pickSeed(seeds.value);

		return await generateFrom(seed, signal, jev.hooks);
	};

	const produce = async (
		client: DiscordClient,
		message: Message,
		signal?: AbortSignal,
	): Promise<Result<void, SqlError>> => {
		const botId = config.discord.client.applicationId;
		const isBotAuthor = message.author.id === botId ||
			message.author.id === config.discord.applicationId;

		if (!isTrackedChannel(markov, message.channelId)) return ok(undefined);

		if (isBotAuthor) return ok(undefined);

		const state = getChannelState(markov, message.channelId);

		const learnResult = await learn(message.content);
		if (!learnResult.ok) return learnResult;

		const isMentioned = message.mentions?.some((m) => m.id === botId) ?? false;
		const isReplyToBot = isMentioned || matches(message.content, markov.pattern) ||
			chat?.isReplyToSelf(toChatMessage(message)) === true;

		const now = Date.now();
		const cooldown = getCooldown(markov, message.channelId);
		let shouldTrigger = ++state.messageCount >= state.triggerThreshold;

		if (!shouldTrigger && isReplyToBot) {
			if (now - state.lastReplyAt > cooldown) {
				log("valid reply detected");
				shouldTrigger = true;
				state.lastReplyAt = now;
			} else {
				log("reply ignored (cooldown active)");
				return ok(undefined);
			}
		}

		if (!shouldTrigger) {
			log(`-${state.triggerThreshold - state.messageCount}`);
			return ok(undefined);
		}

		const { urlConcatChance, urlOnlyChance } = markov;

		safe(client.helpers.triggerTypingIndicator(message.channelId)).catch(() => {});

		const base = await generateReply(message, isReplyToBot, signal);
		if (!base.ok) return base;

		let { value } = base;
		const roll = Math.random() * 1000;

		if (roll < urlConcatChance) {
			log("triggering url concat...");
			const urlResult = await generate("https://", signal);
			if (urlResult.ok) value += " " + urlResult.value;
		} else if (roll < urlOnlyChance) {
			log("triggering url only...");
			const urlResult = await generate("https://", signal);
			if (urlResult.ok) value = urlResult.value;
		}

		value = applyReplacements(value, markov, message.guildId);

		if (signal?.aborted) return ok(undefined);
		const sent = await safe(
			client.helpers.sendMessage(message.channelId, {
				content: value,
				messageReference: isReplyToBot
					? {
						messageId: message.id,
						channelId: message.channelId,
						guildId: message.guildId,
						failIfNotExists: false,
					}
					: undefined,
			}),
		);

		if (!sent.ok) {
			log(`send ✌️ failed: ${sent.error.message}`);
		} else {
			log(`markov: sent "${value}"`);
		}

		resetTrigger(markov, state);
		return ok(undefined);
	};

	const translateReactedMessage = async (
		client: DiscordClient,
		message: Message,
		reaction: Reaction,
		signal?: AbortSignal,
	): Promise<Result<void, AppError>> => {
		if (!config.modules.deepl.enabled) return ok(undefined);

		const botId = config.discord.client.applicationId;
		if (
			reaction.messageAuthorId !== botId ||
			!isTrackedChannel(markov, reaction.channelId)
		) {
			return ok(undefined);
		}

		const translateEmoji = markov.translationEmoji;
		if (reaction.emoji.name !== translateEmoji) return ok(undefined);

		const lastTranslated = translationTimestamps.get(reaction.messageId);
		if (lastTranslated && Date.now() - lastTranslated < TRANSLATION_DEBOUNCE_MS) {
			return ok(undefined);
		}

		const state = getChannelState(markov, reaction.channelId);
		const now = Date.now();
		const cooldown = getCooldown(markov, reaction.channelId);

		if (now - state.lastReactionAt < cooldown) {
			return ok(undefined);
		}

		state.lastReactionAt = now;
		translationTimestamps.set(reaction.messageId, now);

		const reactionCount = message.reactions?.find((r) => r.emoji.name === translateEmoji)?.count ??
			0;
		if (reactionCount > 1) {
			log(`skipping translation; ${reactionCount} reactions of this type exist`);
			return ok(undefined);
		}

		if (signal?.aborted) return ok(undefined);

		safe(
			platform.removeUserReaction(
				reaction.channelId,
				reaction.messageId,
				reaction.userId,
				translateEmoji,
			),
		).catch(() => {});

		const params: TranslateOptions = {
			formality: "prefer_less",
			modelType: "prefer_quality_optimized",
			preserveFormatting: true,
			splitSentences: "1",
		};

		let result = await deepl.translateOne(message.content, "EN", params);
		if (!result.ok) return result;

		let { text, detectedSourceLang } = result.value;
		if (detectedSourceLang.startsWith("EN")) {
			result = await deepl.translateOne(message.content, "PT-BR", params);
			if (!result.ok) return result;
			text = result.value.text;
		}

		text = applyReplacements(text, markov, message.guildId);

		const requester = reaction.user?.username
			? `@${reaction.user.username} (${reaction.userId})`
			: `${reaction.userId}`;
		log(`"${message.content}" → "${text}", requested by ${requester}`);

		const edited = await safe(
			client.helpers.editMessage(reaction.channelId, reaction.messageId, {
				content: text,
			}),
		);
		if (!edited.ok) {
			log("edit failed: " + edited.error.message);
		}
		return discard(edited);
	};

	return {
		messageCreate: (client: DiscordClient, message: Message, signal?: AbortSignal) =>
			produce(client, message, signal),
		translateReactedMessage,
	};
}
