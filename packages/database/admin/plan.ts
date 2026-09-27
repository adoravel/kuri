/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { MutationPlan, RowChange } from "./types.ts";

export function createPlan(description: string, changes: readonly RowChange[]): MutationPlan {
	return { id: crypto.randomUUID(), description, changes, createdAt: Date.now() };
}

export function invertPlan(plan: MutationPlan): MutationPlan {
	return createPlan(
		`undo: ${plan.description}`,
		plan.changes.map((c) => ({ table: c.table, pk: c.pk, before: c.after, after: c.before })),
	);
}
