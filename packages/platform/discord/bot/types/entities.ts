/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DiscordBot } from "../factory.ts";
import type { ReactionAdd } from "./events.ts";

export * from "@discordeno/types";

type InferredTypes = DiscordBot["transformers"]["$inferredTypes"];

type Inferred<K extends keyof InferredTypes> = InferredTypes[K];

export type Guild = Inferred<"guild">;
export type Member = Inferred<"member">;
export type Message = Inferred<"message">;
export type Channel = Inferred<"channel">;
export type Role = Inferred<"role">;
export type Interaction = Inferred<"interaction">;
export type User = Inferred<"user">;
export type MessageInteraction = Inferred<"messageInteraction">;

export type Reaction = Parameters<ReactionAdd>[0];
