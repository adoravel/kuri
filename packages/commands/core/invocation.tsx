/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type {
	Channel,
	CreateMessageOptions,
	DiscordBot,
	Guild,
	Interaction,
	Member,
	Message,
	User,
} from "@kuristina/discord-bot";
import type { AsyncResult, Result } from "@kuristina/core";
import { type AppError, describe } from "@kuristina/errors";
import { ErrorMessage, SuccessMessage } from "@kuristina/discord-ui";
import type { Services } from "@kuristina/domain/services";

export interface InvocationBase<Args = Record<string, unknown>> {
	readonly surface: "text" | "slash";
	readonly args: Args;
	readonly user: User;
	readonly member?: Member;
	readonly guildId?: bigint;
	readonly channelId: bigint;
	readonly platform: DiscordBot;
	readonly invokedAt: number;

	readonly services: Services;

	readonly raw:
		| { readonly kind: "text"; readonly message: Message; readonly isReinvocation: boolean }
		| { readonly kind: "slash"; readonly interaction: Interaction };

	getGuild(): Promise<Guild | undefined>;
	getChannel(): Promise<Channel | undefined>;

	defer(opts?: { ephemeral?: boolean }): Promise<void>;

	reply(
		content: CreateMessageOptions,
		opts?: { ephemeral?: boolean },
	): Promise<{ id: bigint; channelId: bigint } | undefined>;
}

export interface Invocation<Args = Record<string, unknown>> extends InvocationBase<Args> {
	error(content: string): Promise<void>;

	success(content: string): Promise<void>;

	resolve<T, E extends AppError>(result: AsyncResult<T, E> | Result<T, E>): Promise<T | undefined>;
}

export function withReplyHelpers<A>(base: InvocationBase<A>): Invocation<A> {
	const error = async (content: string): Promise<void> => {
		await base.reply({ ...<ErrorMessage>{content}</ErrorMessage> });
	};

	const success = async (content: string): Promise<void> => {
		await base.reply({
			allowedMentions: { repliedUser: true },
			...<SuccessMessage>{content}</SuccessMessage>,
		});
	};

	async function resolve<T, E extends AppError>(
		result: AsyncResult<T, E> | Result<T, E>,
	): Promise<T | undefined> {
		const resolved = await result;
		if (!resolved.ok) {
			await error(describe(resolved.error));
			return undefined;
		}
		return resolved.value;
	}

	return { ...base, error, success, resolve };
}
