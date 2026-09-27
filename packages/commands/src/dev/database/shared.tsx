/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Invocation } from "@kuristina/commands/core";
import { cancelWaiter, waitForInteraction } from "@kuristina/core";
import {
	applyPlan,
	CONFIRM_TIMEOUT_MS,
	type MutationPlan,
	parseKeyValuePairs,
	recordApplied,
	renderDiffMessage,
} from "@kuristina/database/admin";
import { ButtonStyles, type Interaction } from "@kuristina/discord-bot";

export const parseKeyValues = (input: string): Record<string, string> => {
	const result = parseKeyValuePairs(input);
	if (!result.ok) {
		throw new Error(`couldn't parse "${input}": ${result.error}`);
	}
	return result.value;
};

export function evaluateValue(value: string): string {
	if (value === "now()") {
		return Math.floor(Date.now() / 1000).toString();
	}

	if (value === "now(ms)") {
		return Date.now().toString();
	}

	const nowMatch = value.match(/^now\(([+-]?\d+)([smhd])\)$/);
	if (nowMatch) {
		const [, amount, unit] = nowMatch;
		const num = parseInt(amount, 10);
		const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
		const seconds = num * (multipliers[unit] || 1);
		return Math.floor(Date.now() / 1000 + seconds).toString();
	}

	return value;
}

export function evaluateValues<T extends Record<string, unknown>>(obj: T): T {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		result[key] = typeof value === "string" ? evaluateValue(value) : value;
	}
	return result as T;
}

export async function reportCommandError(ctx: Invocation, e: unknown): Promise<void> {
	const message = e instanceof Error
		? e.message
		: typeof e === "object" && e !== null && "message" in e
		? String((e as { message: unknown }).message)
		: String(e);
	await ctx.error(message);
}

export async function confirmAndApply(ctx: Invocation, plan: MutationPlan): Promise<boolean> {
	const rendered = renderDiffMessage(plan);

	const { customId: confirmId, promise: confirmP } = waitForInteraction<Interaction>(
		"db-confirm",
		CONFIRM_TIMEOUT_MS,
		{ filter: (i) => i.user?.id === ctx.user.id },
	);
	const { customId: cancelId, promise: cancelP } = waitForInteraction<Interaction>(
		"db-cancel",
		CONFIRM_TIMEOUT_MS,
		{ filter: (i) => i.user?.id === ctx.user.id },
	);

	const content = rendered.kind === "inline" ? rendered.content : `**${plan.description}**`;
	const files = rendered.kind === "file"
		? [{ blob: rendered.blob, name: rendered.name }]
		: undefined;

	await ctx.reply({
		content,
		files,
		components: [
			<row>
				<button customId={confirmId} style={ButtonStyles.Primary}>Confirm</button>
				<button customId={cancelId} style={ButtonStyles.Secondary}>Cancel</button>
			</row>,
		],
	}, { ephemeral: true });

	const winner = await Promise.race([
		confirmP.then(() => "confirm" as const),
		cancelP.then(() => "cancel" as const),
	]).catch(() => "timeout" as const);

	cancelWaiter(confirmId);
	cancelWaiter(cancelId);

	if (winner !== "confirm") {
		await ctx.reply({
			content: winner === "cancel"
				? "cancelled, nothing changed"
				: "confirmation timed out, nothing changed",
			components: [],
			files: [],
		}, { ephemeral: true });
		return false;
	}

	const applied = await applyPlan(ctx.services.db, plan);
	if (!applied.ok) {
		await ctx.reply({
			content: `apply failed: ${applied.error.message}`,
			components: [],
			files: [],
		}, { ephemeral: true });
		return false;
	}

	recordApplied(plan);
	await ctx.reply({
		content: `applied: ${plan.description} (${plan.changes.length} row change${
			plan.changes.length === 1 ? "" : "s"
		})`,
		components: [],
		files: [],
	}, { ephemeral: true });
	return true;
}
