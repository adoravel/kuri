/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { InteractionResponseTypes, InteractionTypes } from "@discordeno/bot";
import { dispatchSlashInteraction } from "@kuristina/commands/core";
import { TimedMap, waiters } from "@kuristina/core";
import type { Services } from "@kuristina/domain/services";
import type { DiscordBot } from "../factory.ts";
import type { Interaction } from "../types/mod.ts";
import { ackWithMessage } from "../interactions/respond.ts";

const DEDUPE_WINDOW_MS = 15_000;

export function createInteractionCreateHandler(bot: DiscordBot, services: Services) {
	const seen = new TimedMap<bigint, true>(DEDUPE_WINDOW_MS);

	const handleComponent = async (interaction: Interaction): Promise<boolean> => {
		const customId = interaction.data?.customId;
		if (!customId) return false;

		const entry = waiters.get(customId);
		if (!entry) return false;

		if (entry.filter && !entry.filter(interaction)) {
			await ackWithMessage(bot, interaction, { content: "Maybe don't.", ephemeral: true })
				.catch(() => {});
			return true;
		}

		clearTimeout(entry.timeoutId);
		waiters.delete(customId);
		entry.resolve(interaction);
		return true;
	};

	return async (interaction: Interaction): Promise<void> => {
		if (
			interaction.type === InteractionTypes.ApplicationCommand ||
			interaction.type === InteractionTypes.ApplicationCommandAutocomplete
		) {
			await dispatchSlashInteraction(bot, interaction, services);
			return;
		}

		if (interaction.type !== InteractionTypes.MessageComponent || !interaction.data?.customId) {
			return;
		}

		if (seen.get(interaction.id)) {
			logger.warn(`interactionCreate: dropped duplicate delivery of interaction ${interaction.id}`);
			return;
		}
		seen.set(interaction.id, true);

		if (await handleComponent(interaction)) return;

		await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
			type: InteractionResponseTypes.DeferredUpdateMessage,
		}).catch(() => {});
	};
}
