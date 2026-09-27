/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DiscordClient } from "@kuristina/discord-client";
import { patchDeviceIdentifier, patchReadyHandler } from "./gateway.ts";
import { applyHeadersInterceptor } from "./headers.ts";
import {
	patchAuthorisationHeader,
	patchMessageOperations,
	patchOutgoingRequestProcessing,
	patchSessionInfo,
} from "./rest.ts";

export function prepareClient(client: DiscordClient): void {
	applyHeadersInterceptor(client);
	patchAuthorisationHeader(client);
	patchOutgoingRequestProcessing(client);
	patchSessionInfo(client);
	patchReadyHandler(client);
	patchMessageOperations(client);
	patchDeviceIdentifier(client);
}

export * from "./constants.ts";
export * from "./crypto.ts";
export * from "./headers.ts";
export * from "./gateway.ts";
export * from "./rest.ts";
