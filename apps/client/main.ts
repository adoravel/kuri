/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { bootstrap } from "@kuristina/runtime";
import { startClient } from "@kuristina/discord-client";

if (import.meta.main) await bootstrap(startClient);
