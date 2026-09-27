/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { sql } from "@kysely/kysely";
import type { AsyncResult } from "@kuristina/core";
import type { Database } from "./connection.ts";
import type { SqlError } from "./errors.ts";
import type { Repositories } from "./repository/mod.ts";

export interface MaintenanceConfig {
	cacheTtlSeconds: number;
	companionRetentionSeconds: number;
	lastfmCacheTtlSeconds: number;
}

export interface PurgeOutcome {
	task: string;
	deleted: number;
}

function purgeTasks(
	repositories: Repositories,
	config: MaintenanceConfig,
): Record<string, () => AsyncResult<number, SqlError>> {
	return {
		external_cache: () => repositories.cache.purgeExpired(config.cacheTtlSeconds),
		lastfm_response_cache: () =>
			repositories.lastfmCache.purgeExpired(config.lastfmCacheTtlSeconds),
		message_companions: () =>
			repositories.messageCompanions.purgeOlderThan(config.companionRetentionSeconds),
	};
}

export async function runMaintenance(
	db: Database,
	repositories: Repositories,
	config: MaintenanceConfig,
): Promise<PurgeOutcome[]> {
	const outcomes: PurgeOutcome[] = [];
	let purged = 0;

	for (const [task, purge] of Object.entries(purgeTasks(repositories, config))) {
		const result = await purge();
		if (!result.ok) {
			logger.boo(`maintenance: "${task}" failed:`, result.error);
			continue;
		}

		outcomes.push({ task, deleted: result.value });
		purged += result.value;
		if (result.value > 0) logger.yay(`maintenance: "${task}" purged ${result.value} rows`);
	}

	if (purged > 0) {
		await sql`PRAGMA incremental_vacuum`.execute(db).catch((e) =>
			logger.warn("maintenance: incremental vacuum failed:", e)
		);
	}

	return outcomes;
}

export function scheduleMaintenance(
	db: Database,
	repositories: Repositories,
	config: MaintenanceConfig,
	intervalMs: number,
): () => void {
	const tick = () =>
		runMaintenance(db, repositories, config).catch((e) => logger.boo("maintenance: crashed:", e));

	void tick();
	const timer = setInterval(tick, intervalMs);
	Deno.unrefTimer(timer);

	return () => clearInterval(timer);
}
