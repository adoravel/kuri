/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ArgsShape, CommandSpec } from "./spec.ts";
import { type CompiledSlashCommand, toSlashCommand } from "./slash-adapter.ts";
import { registerTextCommand } from "./text-adapter.ts";
import type { Middleware } from "./middleware.ts";

export const slashCommands = new Map<
	string,
	{ spec: CommandSpec<any>; compiled: CompiledSlashCommand }
>();
const allSpecs: CommandSpec<any>[] = [];

const globalMiddleware: Middleware[] = [];

export function use(middleware: Middleware): void {
	globalMiddleware.push(middleware);
	globalMiddleware.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
}

export function getGlobalMiddleware(): Middleware[] {
	return globalMiddleware;
}

export function registerCommand<A extends ArgsShape>(spec: CommandSpec<A>): void {
	allSpecs.push(spec);
	if (spec.surfaces === "text" || spec.surfaces === "both") {
		registerTextCommand(spec);
	}
	if (spec.surfaces === "slash" || spec.surfaces === "both") {
		slashCommands.set(spec.aliases[0], { spec, compiled: toSlashCommand(spec) });
	}
}

export function getAllCommands(): readonly CommandSpec<any>[] {
	return allSpecs;
}

export function getRegisteredSlashCommands(): CompiledSlashCommand[] {
	return [...slashCommands.values()].map((e) => e.compiled);
}
