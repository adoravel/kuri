/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Services } from "@kuristina/domain/services";
import type { GuildMemberAdd, GuildMemberRemove } from "../types/mod.ts";

export function createMemberHandlers(services: Services): {
	guildMemberAdd: GuildMemberAdd;
	guildMemberRemove: GuildMemberRemove;
} {
	const { members } = services.repos;

	return {
		guildMemberAdd: async (member) => {
			if (!member.guildId) {
				logger.boo("memberAdd: guild id not available");
				return;
			}

			const result = await members.setPresent(member.id, member.guildId);
			if (!result.ok) logger.boo("memberAdd: failed to update guild presence:", result.error);
		},

		guildMemberRemove: async (user, guildId) => {
			const result = await members.setAbsent(user.id, guildId);
			if (!result.ok) logger.boo("memberRemove: failed to update guild presence:", result.error);
		},
	};
}
