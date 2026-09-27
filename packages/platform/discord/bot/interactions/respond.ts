/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { InteractionResponseTypes, MessageFlags } from "@discordeno/bot";
import type { DiscordBot } from "../factory.ts";
import type { CreateMessageOptions, Interaction } from "../types/mod.ts";

export async function ackDeferUpdate(bot: DiscordBot, interaction: Interaction): Promise<void> {
	await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
		type: InteractionResponseTypes.DeferredUpdateMessage,
	});
}

export async function ackWithMessage(
	bot: DiscordBot,
	interaction: Interaction,
	content: CreateMessageOptions & { ephemeral?: boolean },
): Promise<void> {
	const { ephemeral, ...data } = content;
	const flags = ephemeral ? (data.flags ?? 0) | MessageFlags.Ephemeral : data.flags;

	try {
		await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: { ...data, flags },
		});
	} catch (e) {
		const alreadyAcked = e instanceof Error && e.message.includes("40060");
		if (!alreadyAcked) throw e;

		logger.warn(
			`ackWithMessage: interaction ${interaction.id} was already acked, falling back to followup`,
		);
		await bot.helpers.sendFollowupMessage(interaction.token, { ...data, flags });
	}
}
