/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DiscordGetGatewayBot } from "@discordeno/types";
import type { CamelCase } from "@kuristina/core";

export const CLIENT_VERSION = "0.0.670";
export const CLIENT_BUILD_NUMBER = 397417;
export const RELEASE_CHANNEL = "canary";
export const DEFAULT_LOCALE = "en-US";
export const DEFAULT_TIMEZONE = "America/New_York";

export const ELECTRON_VERSION = "35.1.5";
export const CHROME_VERSION = "134.0.6998.179";

export const OS = "Linux";
export const OS_VERSION = "6.8.0-31-generic";
export const OS_ARCH = "x64";
export const APP_ARCH = "x64";
export const WINDOW_MANAGER = "GNOME,gnome";
export const DISTRO = "Ubuntu 24.04.4 LTS";
export const BROWSER = "Discord Client";

export const SESSION_INFO: CamelCase<DiscordGetGatewayBot> = {
	url: "wss://gateway.discord.gg",
	shards: 1,
	sessionStartLimit: {
		maxConcurrency: 1,
		remaining: 999,
		resetAfter: 14_400_000,
		total: 1000,
	},
};

export const MESSAGE_DEFAULTS = {
	tts: false,
	flags: 0,
	mobileNetworkType: "unknown",
	nonce: () => Math.floor(Date.now() / 1000),
} as const;
