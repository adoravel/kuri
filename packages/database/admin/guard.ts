/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { ADMIN_EDITABLE_TABLES, type AdminEditableTable } from "./constants.ts";

export const isEditableTable = (table: string): table is AdminEditableTable =>
	ADMIN_EDITABLE_TABLES.includes(table as AdminEditableTable);

export function assertEditableTable(table: string): asserts table is AdminEditableTable {
	if (!isEditableTable(table)) {
		throw new Error(`"${table}" isn't in the admin-editable allowlist`);
	}
}
