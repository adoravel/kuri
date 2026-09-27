/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DiscordClient } from "@kuristina/discord-client";
import {
	APP_ARCH,
	BROWSER,
	CHROME_VERSION,
	CLIENT_BUILD_NUMBER,
	CLIENT_VERSION,
	DEFAULT_LOCALE,
	DEFAULT_TIMEZONE,
	DISTRO,
	ELECTRON_VERSION,
	OS,
	OS_ARCH,
	OS_VERSION,
	RELEASE_CHANNEL,
	WINDOW_MANAGER,
} from "./constants.ts";
import { generateLaunchSignature, generateUUID } from "./crypto.ts";

export interface ClientHeaders {
	"User-Agent": string;
	"X-Super-Properties": string;
	"X-Discord-Locale": string;
	"X-Discord-Timezone": string;
	"X-Debug-Options"?: string;
	Referer?: string;
	"Accept-Language"?: string;
	"Sec-CH-UA"?: string;
	"Sec-CH-UA-Mobile"?: string;
	"Sec-CH-UA-Platform"?: string;
	"Sec-Fetch-Dest"?: string;
	"Sec-Fetch-Mode"?: string;
	"Sec-Fetch-Site"?: string;
	[key: string]: string | undefined;
}

export interface SuperProperties {
	os: string;
	browser: string;
	release_channel: string;
	client_version: string;
	os_version: string;
	os_arch: string;
	app_arch: string;
	system_locale: string;
	has_client_mods: boolean;
	client_launch_id: string;
	launch_signature: string;
	browser_user_agent: string;
	browser_version: string;
	window_manager: string;
	distro: string;
	client_build_number: number;
	native_build_number: null;
	client_event_source: null;
	client_heartbeat_session_id: string;
}

export function buildUserAgent(): string {
	return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) discord/${CLIENT_VERSION} Chrome/${CHROME_VERSION} Electron/${ELECTRON_VERSION} Safari/537.36`;
}

export function buildSuperProperties(): SuperProperties {
	return {
		os: OS,
		browser: BROWSER,
		release_channel: RELEASE_CHANNEL,
		client_version: CLIENT_VERSION,
		os_version: OS_VERSION,
		os_arch: OS_ARCH,
		app_arch: APP_ARCH,
		system_locale: DEFAULT_LOCALE,
		has_client_mods: false,
		client_launch_id: generateUUID(),
		launch_signature: generateLaunchSignature(),
		browser_user_agent: buildUserAgent(),
		browser_version: ELECTRON_VERSION,
		window_manager: WINDOW_MANAGER,
		distro: DISTRO,
		client_build_number: CLIENT_BUILD_NUMBER,
		native_build_number: null,
		client_event_source: null,
		client_heartbeat_session_id: generateUUID(),
	};
}

export function encodeSuperProperties(props: SuperProperties): string {
	return btoa(JSON.stringify(props));
}

export function buildClientHeaders(options: {
	locale?: string;
	timezone?: string;
	referer?: string;
	debug?: boolean;
} = {}): ClientHeaders {
	const locale = options.locale ?? DEFAULT_LOCALE;
	const timezone = options.timezone ?? DEFAULT_TIMEZONE;
	const userAgent = buildUserAgent();

	const headers: ClientHeaders = {
		"User-Agent": userAgent,
		"X-Super-Properties": encodeSuperProperties(buildSuperProperties()),
		"X-Discord-Locale": locale,
		"X-Discord-Timezone": timezone,
	};

	if (options.referer) {
		headers.Referer = options.referer;
	}

	if (options.debug) {
		headers["X-Debug-Options"] = "bugReporterEnabled";
	}

	const chromeMajor = CHROME_VERSION.split(".")[0];
	headers["Sec-CH-UA"] =
		`"Google Chrome";v="${chromeMajor}", "Chromium";v="${chromeMajor}", "Not?A_Brand";v="99"`;
	headers["Sec-CH-UA-Mobile"] = "?0";
	headers["Sec-CH-UA-Platform"] = '"Linux"';
	headers["Sec-Fetch-Dest"] = "empty";
	headers["Sec-Fetch-Mode"] = "cors";
	headers["Sec-Fetch-Site"] = "same-origin";

	return headers;
}

export function applyHeadersInterceptor(client: DiscordClient): void {
	const original = client.rest.createRequestBody;

	client.rest.createRequestBody = (method, options) => {
		const body = original.call(client.rest, method, options);
		const clientHeaders = buildClientHeaders({});

		if (body.headers instanceof Headers) {
			for (const [key, value] of Object.entries(clientHeaders)) {
				if (value && !body.headers.has(key)) body.headers.set(key, value);
			}
		} else {
			const headers = (body.headers ?? {}) as Record<string, string>;

			for (const [key, value] of Object.entries(clientHeaders)) {
				if (value && !headers[key]) headers[key] = value;
			}
			body.headers = headers;
		}

		return body;
	};
}
