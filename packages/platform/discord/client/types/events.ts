/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DiscordClient } from "../factory.ts";

export type Events = DiscordClient["events"];

export type Event<E extends keyof Events> = NonNullable<Events[E]>;

export type ReactionAdd = Event<"reactionAdd">;

export type MessageCreate = Event<"messageCreate">;
