/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { type AsyncResult, ok } from "@kuristina/core";
import type { SqlError } from "../errors.ts";
import { Repository } from "./helper.ts";

export type RichLinkProvider =
	| "github"
	| "forgejo"
	| "twitter"
	| "fediverse"
	| "bluesky"
	| "cache"
	| "musiclinks";

export type CompanionKind = "command" | `richlink:${RichLinkProvider}`;

export const RICHLINK_KIND_PREFIX = "richlink:";

export interface MessageCompanion {
	responseMessageId: bigint;
	channelId: bigint;
	kind: CompanionKind;
	sourceUrl: string | null;
}

const COMPANION_COLUMNS = ["response_message_id", "channel_id", "kind", "source_url"] as const;

function toCompanion(
	row: { response_message_id: string; channel_id: string; kind: string; source_url: string | null },
): MessageCompanion {
	return {
		responseMessageId: BigInt(row.response_message_id),
		channelId: BigInt(row.channel_id),
		kind: row.kind as CompanionKind,
		sourceUrl: row.source_url,
	};
}

export class MessageCompanionRepository extends Repository {
	add(
		sourceId: bigint,
		responseId: bigint,
		channelId: bigint,
		kind: CompanionKind,
		sourceUrl?: string,
	): AsyncResult<void, SqlError> {
		return this.mutate("add", (db) =>
			db.insertInto("message_companions")
				.values({
					source_message_id: sourceId.toString(),
					response_message_id: responseId.toString(),
					channel_id: channelId.toString(),
					kind,
					created_at: Math.floor(Date.now() / 1000),
					source_url: sourceUrl ?? null,
				})
				.onConflict((oc) => oc.column("response_message_id").doNothing())
				.execute());
	}

	getForSource(sourceId: bigint, kind?: CompanionKind): AsyncResult<MessageCompanion[], SqlError> {
		return this.attempt("getForSource", async (db) => {
			let query = db.selectFrom("message_companions")
				.select(COMPANION_COLUMNS)
				.where("source_message_id", "=", sourceId.toString());
			if (kind) query = query.where("kind", "=", kind);

			return (await query.execute()).map(toCompanion);
		});
	}

	getForSourceByPrefix(
		sourceId: bigint,
		kindPrefix: string,
	): AsyncResult<MessageCompanion[], SqlError> {
		return this.attempt("getForSourceByPrefix", async (db) => {
			const rows = await db.selectFrom("message_companions")
				.select(COMPANION_COLUMNS)
				.where("source_message_id", "=", sourceId.toString())
				.where("kind", "like", `${kindPrefix}%`)
				.execute();

			return rows.map(toCompanion);
		});
	}

	deleteResponses(sourceId: bigint, responseIds: bigint[]): AsyncResult<void, SqlError> {
		if (!responseIds.length) return Promise.resolve(ok(undefined));

		return this.mutate("deleteResponses", (db) =>
			db.deleteFrom("message_companions")
				.where("source_message_id", "=", sourceId.toString())
				.where("response_message_id", "in", responseIds.map(String))
				.execute());
	}

	deleteForSource(sourceId: bigint, kind?: CompanionKind): AsyncResult<void, SqlError> {
		return this.mutate("deleteForSource", (db) => {
			let query = db.deleteFrom("message_companions")
				.where("source_message_id", "=", sourceId.toString());
			if (kind) query = query.where("kind", "=", kind);
			return query.execute();
		});
	}

	purgeOlderThan(retentionSeconds: number): AsyncResult<number, SqlError> {
		return this.affected("purgeOlderThan", (db) =>
			db.deleteFrom("message_companions")
				.where("created_at", "<", Math.floor(Date.now() / 1000) - retentionSeconds)
				.executeTakeFirst());
	}
}
