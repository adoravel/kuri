/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { bgRgb24, bold, rgb24 } from "@std/fmt/colors";

export const bg = (hex: string) => {
	const numericHex = parseInt(hex.replace("#", ""), 16);
	return (text: string) => bgRgb24(text, numericHex);
};
export const fg = (hex: string) => {
	const numericHex = parseInt(hex.replace("#", ""), 16);
	return (text: string) => rgb24(text, numericHex);
};

export interface BadgeOptions {
	label: string;
	bg: (s: string) => string;
	fg?: (s: string) => string;
}

export function createBadge({ label, bg, fg = bold }: BadgeOptions): string {
	return bg(fg(` ${label} `));
}

export const badges = {
	warn: createBadge({ label: "warn", bg: bg("#f59e0b"), fg: fg("#000000") }),
	build: createBadge({ label: "build", bg: bg("#a855f7"), fg: fg("#000000") }),
	success: createBadge({ label: "success", bg: bg("#22c55e"), fg: fg("#000000") }),
	error: createBadge({ label: "error", bg: bg("#ef4444"), fg: fg("#000000") }),
	info: createBadge({ label: "info", bg: bg("#3b82f6"), fg: fg("#000000") }),
	debug: createBadge({ label: "debug", bg: bg("#3f3f46"), fg: fg("#d4d4d8") }),
};

export type BadgeName = keyof typeof badges;
