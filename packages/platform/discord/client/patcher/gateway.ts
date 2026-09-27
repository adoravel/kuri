/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DiscordGatewayPayload } from "@discordeno/types";
import type { DiscordClient, DiscordReady } from "@kuristina/discord-client";
import { OS } from "./constants.ts";

export function patchReadyHandler(client: DiscordClient): void {
	client.handlers.READY = (app, data: DiscordGatewayPayload) => {
		if (!app.events.ready) return;

		const payload = data.d as DiscordReady;
		const userId = app.transformers.snowflake(payload.user.id);
		app.id = userId;

		app.events.ready(
			{
				shardId: 0,
				v: payload.v,
				user: app.transformers.user(app, payload.user),
				guilds: payload.guilds.map((g) => app.transformers.snowflake(g.id)),
				sessionId: payload.session_id,
				shard: payload.shard,
				applicationId: BigInt(userId),
			},
			payload,
		);
	};
}

export function patchDeviceIdentifier(client: DiscordClient): void {
	client.gateway.properties = {
		os: OS,
		browser: "Discord Client",
		device: "",
	};
}
