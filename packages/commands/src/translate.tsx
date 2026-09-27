/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe } from "@kuristina/errors";
import { defineCommand, string } from "@kuristina/commands/core";
import type { DiscordBot, Message } from "@kuristina/discord-bot";
import { deepl } from "@kuristina/services/translation";
import {
	formatLanguage,
	isSupportedSourceLang,
	isSupportedTargetLang,
	resolveFormality,
	resolveModelType,
} from "@kuristina/services/translation/deepl";
import type {
	Formality,
	ModelType,
	SourceLang,
	TargetLang,
} from "@kuristina/services/translation/deepl";

const DISCORD_EMOJI_RE = /<a?:\w+:\d+>/g;
const UNICODE_EMOJI_RE =
	/\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*[\uFE0F\u{1F3FB}-\u{1F3FF}]*/gu;

const DEFAULT_TARGET: TargetLang = "EN-GB";

function truncate(text: string, max: number): string {
	return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export function stripEmoji(text: string): string {
	return text.replace(DISCORD_EMOJI_RE, "").replace(UNICODE_EMOJI_RE, "");
}

export function visibleLength(text: string): number {
	return [...stripEmoji(text)].length;
}

async function getRepliedMessage(
	platform: DiscordBot,
	message: Message,
): Promise<Message | undefined> {
	const ref = message.messageReference;
	if (!ref?.messageId) return undefined;

	try {
		return await platform.helpers.getMessage(message.channelId, ref.messageId);
	} catch {
		return undefined;
	}
}

async function getMentionedUsersLastMessages(
	platform: DiscordBot,
	message: Message,
): Promise<string[]> {
	const mentions = message.mentions;
	if (!mentions?.length) return [];

	const messages = await platform.helpers.getMessages(message.channelId, { limit: 25 });

	const pendingMentions = new Map(mentions.map((m) => [m.id, m]));
	const results: string[] = [];

	for (const msg of messages) {
		const authorId = msg.author.id;

		if (pendingMentions.has(authorId)) {
			const content = msg.content.replace(/<@!?\d+>/g, "").trim();
			if (content) {
				results.push(`-# <@${msg.author.id}>\n${content}`);
			}
			pendingMentions.delete(authorId);
		}

		if (pendingMentions.size === 0) break;
	}

	return results;
}

async function getTranslationText(
	platform: DiscordBot,
	message: Message | undefined,
	input: string,
	threshold: number,
): Promise<{ text: string; source: string }> {
	let text = input.trim();
	let source = "from command input";

	if (message) {
		if (!text || text.length < threshold) {
			const replied = await getRepliedMessage(platform, message);
			if (replied?.content) {
				text = replied.content.trim();
				source = "from replied message";
			}
		}

		const clean = text.replace(/<@!?\d+>/g, "").trim();

		if (!clean || clean.length < threshold) {
			const mentionedMessages = await getMentionedUsersLastMessages(platform, message);
			if (mentionedMessages.length) {
				text = mentionedMessages.join("\n\n");
				const count = message.mentions?.length ?? 0;
				source = count > 1 ? `from ${count} mentions` : "from a mention";
			}
		}
	}

	return { text, source };
}

export default defineCommand({
	aliases: ["translate", "trans", "tr", "t", "übersetzen", "ubersetzen", "traduzir", "traduz"],
	description:
		"Translates text. `to` sets the target (default EN-GB), `from` pins the source, `formality` and `model` tune the translation.",
	category: "utility",
	cooldownMs: 3000,
	args: {
		text: string({
			description: "text to translate (or leave blank to use a reply/mention)",
			greedy: true,
		}),
		to: string({ description: "target language, e.g. EN-US, PT-BR, JA" }),
		from: string({ description: "source language, e.g. EN, PT, JA" }),
		formality: string({ description: "formality", choices: ["more", "less", "default"] }),
		model: string({ description: "model", choices: ["quality", "prefer_quality", "latency"] }),
	},
	async exec(ctx) {
		const input = ctx.args.text?.trim() ?? "";

		const { text, source: inputSource } = await getTranslationText(
			ctx.platform,
			ctx.raw.kind === "text" ? ctx.raw.message : undefined,
			input,
			3,
		);

		if (!text || text.length < 3) {
			return void await ctx.error(
				"give me something to translate first, reply to a message, or mention someone",
			);
		}
		const truncated = truncate(text, 1800);

		const target = (ctx.args.to?.toUpperCase() ?? DEFAULT_TARGET) as TargetLang;
		const source = ctx.args.from?.toUpperCase() as SourceLang | undefined;

		if (!isSupportedTargetLang(target)) {
			return void await ctx.error(
				`"${target}" isn't a target language DeepL supports. Try e.g. \`EN-US\`, \`PT-BR\`, \`JA\`.`,
			);
		}
		if (source && !isSupportedSourceLang(source)) {
			return void await ctx.error(
				`"${source}" isn't a source language DeepL supports. Try e.g. \`EN\`, \`PT\`, \`JA\`.`,
			);
		}

		let formality: Formality | undefined;
		if (ctx.args.formality) {
			formality = resolveFormality(ctx.args.formality);
			if (!formality) {
				return void await ctx.error(
					`"${ctx.args.formality}" isn't a recognised formality. Try \`more\`, \`less\`, or \`default\`.`,
				);
			}
		}

		let modelType: ModelType | undefined;
		if (ctx.args.model) {
			modelType = resolveModelType(ctx.args.model);
			if (!modelType) {
				return void await ctx.error(
					`"${ctx.args.model}" isn't a recognised model. Try \`quality\`, \`latency\`, or \`balanced\`.`,
				);
			}
		}

		const [result, usage] = await Promise.all([
			deepl.translateOne(truncated, target, {
				sourceLang: source,
				formality,
				modelType,
				preserveFormatting: true,
			}),
			deepl.getUsage(),
		]);

		if (!result.ok) {
			return void await ctx.error(describe(result.error));
		}

		const { text: translated, detectedSourceLang } = result.value;

		const tuning: string[] = [];
		if (modelType) tuning.push(`model: ${modelType}`);
		if (formality) tuning.push(`formality: ${formality}`);
		tuning.push(inputSource);

		if (usage.ok) {
			const { fraction, characterCount, characterLimit } = usage.value;
			const pct = (fraction * 100).toFixed(2);
			tuning.push(
				`${characterCount.toLocaleString()} / ${characterLimit.toLocaleString()} characters used this period (${pct}%)`,
			);
		}

		await ctx.reply(
			<message>
				<p>
					<sub>
						↑ {formatLanguage(source ?? detectedSourceLang)}
						{source ? " (forced)" : ""}
					</sub>
				</p>
				<p>
					<blockquote>{truncated}</blockquote>
				</p>
				<hr spacing={2} />
				<p>
					<sub>↓ {formatLanguage(target)}</sub>
				</p>
				<p>
					<blockquote>{translated}</blockquote>
				</p>
				<hr spacing={2} />
				<p>
					<sub>{tuning.join(" · ")}</sub>
				</p>
			</message>,
		);
	},
});
