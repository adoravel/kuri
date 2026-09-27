/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CreateMessageOptions } from "@discordeno/types";
import type { RichLinkProvider } from "@kuristina/database";

export type MessagePayload = CreateMessageOptions;

export interface SourceMessage {
	readonly id: bigint;
	readonly channelId: bigint;
	readonly guildId?: bigint;
	readonly content: string;
}

export interface RichLinkPlatform {
	sendReply(message: SourceMessage, payload: MessagePayload): Promise<{ id: bigint }>;
	deleteMessage(channelId: bigint, messageId: bigint): Promise<void>;
	suppressEmbeds(message: SourceMessage): Promise<void>;
	canEmbed(guildId: bigint, channelId: bigint): Promise<boolean>;
}

export interface LinkItem {
	readonly key: string;
	render(signal?: AbortSignal): Promise<MessagePayload | undefined>;
}

export interface LinkHandler {
	readonly provider: RichLinkProvider;
	readonly enabled: boolean;
	items(content: string): LinkItem[];
}
