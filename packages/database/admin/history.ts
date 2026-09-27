/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { MutationPlan } from "./types.ts";
import { MAX_HISTORY } from "./constants.ts";

const history: MutationPlan[] = [];

export const recordApplied = (plan: MutationPlan): void => {
	history.push(plan);
	if (history.length > MAX_HISTORY) history.shift();
};

export const peekLastPlan = (): MutationPlan | undefined => history[history.length - 1];

export const popLastPlan = (): MutationPlan | undefined => history.pop();

export const getHistory = (): readonly MutationPlan[] => history;
