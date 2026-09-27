/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Invocation } from "./invocation.tsx";
import { cancelWaiter, waitForInteraction } from "@kuristina/core";
import { ackDeferUpdate } from "@kuristina/discord-bot";
import { ButtonStyles, type CreateMessageOptions, type Interaction } from "@kuristina/discord-bot";

const DEFAULT_TIMEOUT_MS = 120_000;

export interface PaginatorOptions {
	readonly id: string;
	readonly timeoutMs?: number;
	readonly totalPages?: number;
	readonly ephemeral?: boolean;

	renderPage(page: number): Promise<CreateMessageOptions> | CreateMessageOptions;
}

export async function runPaginator(ctx: Invocation, opts: PaginatorOptions): Promise<void> {
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	let page = 0;

	while (true) {
		const rendered = await opts.renderPage(page);

		const { customId: prevId, promise: prevP } = waitForInteraction<Interaction>(
			`${opts.id}-prev`,
			timeoutMs,
			{ filter: (i) => i.user?.id === ctx.user.id },
		);
		const { customId: nextId, promise: nextP } = waitForInteraction<Interaction>(
			`${opts.id}-next`,
			timeoutMs,
			{ filter: (i) => i.user?.id === ctx.user.id },
		);
		const { customId: closeId, promise: closeP } = waitForInteraction<Interaction>(
			`${opts.id}-close`,
			timeoutMs,
			{ filter: (i) => i.user?.id === ctx.user.id },
		);

		const atFirstPage = page === 0;
		const atLastPage = opts.totalPages !== undefined && page >= opts.totalPages - 1;

		await ctx.reply({
			...rendered,
			components: [
				...(rendered.components ?? []),
				<row>
					<button customId={prevId} style={ButtonStyles.Secondary} disabled={atFirstPage}>
						← Prev
					</button>
					<button customId={nextId} style={ButtonStyles.Secondary} disabled={atLastPage}>
						Next →
					</button>
					<button customId={closeId} style={ButtonStyles.Danger}>✕</button>
				</row>,
			],
		}, { ephemeral: opts.ephemeral });

		const winner = await Promise.race([
			prevP.then((i) => ({ kind: "prev" as const, interaction: i })),
			nextP.then((i) => ({ kind: "next" as const, interaction: i })),
			closeP.then((i) => ({ kind: "close" as const, interaction: i })),
		]).catch(() => ({ kind: "timeout" as const, interaction: undefined }));

		cancelWaiter(prevId);
		cancelWaiter(nextId);
		cancelWaiter(closeId);

		if (winner.interaction) {
			await ackDeferUpdate(ctx.platform, winner.interaction).catch((e) =>
				logger.warn(`paginator(${opts.id}): failed to ack click: ` + e)
			);
		}

		if (winner.kind === "prev") page = Math.max(0, page - 1);
		else if (winner.kind === "next") {
			page = opts.totalPages !== undefined ? Math.min(opts.totalPages - 1, page + 1) : page + 1;
		} else return;
	}
}
