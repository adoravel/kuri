/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DiscordClient } from "@kuristina/discord-client";
import { MESSAGE_DEFAULTS, SESSION_INFO } from "./constants.ts";
import type { CreateMessageOptions, EditMessage } from "@discordeno/types";

export function patchAuthorisationHeader(client: DiscordClient): void {
	const original = client.rest.createRequestBody;
	client.rest.createRequestBody = (method, options) => {
		const body = original.call(client.rest, method, options);
		if (typeof body.headers.authorization === "string") {
			body.headers.authorization = body.headers.authorization.slice(4);
		}
		return body;
	};
}

export function patchOutgoingRequestProcessing(client: DiscordClient): void {
	const original = client.rest.processRequest;
	client.rest.processRequest = (opts) => {
		opts.runThroughQueue = false;
		return original.call(client.rest, opts);
	};
}

export function patchSessionInfo(client: DiscordClient): void {
	client.rest.getSessionInfo = () => Promise.resolve(SESSION_INFO);
}

function normaliseMessageOptions<T extends CreateMessageOptions | EditMessage>(opts: T): T {
	const norm = { ...opts };

	norm.flags ??= MESSAGE_DEFAULTS.flags;

	if ("tts" in norm) {
		norm.tts ??= MESSAGE_DEFAULTS.tts;
	}
	if ("mobileNetworkType" in norm) {
		norm.mobileNetworkType ??= MESSAGE_DEFAULTS.mobileNetworkType;
	}
	if ("nonce" in norm && !norm.nonce) {
		norm.nonce = MESSAGE_DEFAULTS.nonce();
	}

	return norm;
}

export function patchMessageOperations(client: DiscordClient): void {
	const { sendMessage: send, editMessage: edit } = client.rest;

	client.rest.sendMessage = (channelId, opts) => {
		return send.call(client.rest, channelId, normaliseMessageOptions(opts));
	};

	client.rest.editMessage = (channelId, messageId, opts) => {
		return edit.call(client.rest, channelId, messageId, normaliseMessageOptions(opts));
	};
}
