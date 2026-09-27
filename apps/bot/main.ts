/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { bootstrap } from "@kuristina/runtime";
import { startBot } from "@kuristina/discord-bot";

if (import.meta.main) await bootstrap(startBot);
