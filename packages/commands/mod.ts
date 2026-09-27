/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type CommandSpec, registerCommand } from "@kuristina/commands/core";

import help from "./src/help.tsx";
import ping from "./src/ping.tsx";
import role from "./src/role.tsx";
import translate from "./src/translate.tsx";
import embed from "./src/embed.tsx";

import fm from "./src/fm/mod.ts";
import nowplaying from "./src/fm/nowplaying.tsx";
import whoknows from "./src/fm/whoknows.tsx";
import whoknowsalbum from "./src/fm/whoknowsalbum.tsx";
import whoknowstrack from "./src/fm/whoknowstrack.tsx";
import artisttrack from "./src/fm/artisttrack.tsx";
import artistalbum from "./src/fm/artistalbum.tsx";
import scrobble from "./src/fm/scrobble.tsx";
import { love, unrate } from "./src/fm/rate.tsx";

import forget from "./src/markov/forget.tsx";
import prune from "./src/markov/prune.tsx";

import restart from "./src/dev/restart.tsx";
import update from "./src/dev/update.tsx";
import evaluate from "./src/dev/eval.tsx";
import database from "./src/dev/database/mod.tsx";

export const commands: readonly CommandSpec<any>[] = [
	help,
	ping,
	role,
	translate,
	embed,
	fm,
	nowplaying,
	whoknows,
	whoknowsalbum,
	whoknowstrack,
	artisttrack,
	artistalbum,
	scrobble,
	love,
	unrate,
	forget,
	prune,
	restart,
	update,
	evaluate,
	database,
];

export function registerAllCommands(): void {
	for (const spec of commands) registerCommand(spec);
}
