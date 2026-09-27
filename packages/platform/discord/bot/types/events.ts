/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DiscordBot } from "../factory.ts";

export type Events = DiscordBot["events"];

export type Event<E extends keyof Events> = NonNullable<Events[E]>;

export type ReactionAdd = Event<"reactionAdd">;

export type MessageCreate = Event<"messageCreate">;
export type MessageUpdate = Event<"messageUpdate">;
export type MessageDelete = Event<"messageDelete">;

export type GuildMemberAdd = Event<"guildMemberAdd">;
export type GuildMemberRemove = Event<"guildMemberRemove">;

export type GuildCreate = Event<"guildCreate">;
export type GuildDelete = Event<"guildDelete">;

export type InteractionCreate = Event<"interactionCreate">;
