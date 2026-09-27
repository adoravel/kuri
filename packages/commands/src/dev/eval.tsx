/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand, ownerOnly } from "@kuristina/commands/core";
import { runDeno, type Sandbox, type SpawnOutcome } from "@kuristina/core";
import { NET_FLAG_RE, stripCodeFence, wrapSource } from "./eval-source.ts";

const TIMEOUT_MS = 5_000;
const MAX_FIELD_LENGTH = 1_000;
const MAX_SOURCE_LENGTH = 4_000;

const STRICT: Sandbox = {};
const NETWORKED: Sandbox = { net: true, import: true };

const block = (label: string, body: string): string => {
	const text = body.length > MAX_FIELD_LENGTH ? body.slice(0, MAX_FIELD_LENGTH - 1) + "…" : body;
	return `**${label}**\n\`\`\`ansi\n${text}\n\`\`\``;
};

function report(outcome: SpawnOutcome, networked: boolean): string {
	const parts: string[] = [];

	if (outcome.timedOut) parts.push(`⏱ killed after ${TIMEOUT_MS}ms`);
	if (outcome.stdout) parts.push(block("stdout", outcome.stdout));
	if (outcome.stderr) parts.push(block("stderr", outcome.stderr));

	if (!parts.length) {
		parts.push(outcome.success ? "no output" : `exited with code ${outcome.code}, no output`);
	}

	parts.push(
		`-# ${networked ? "net" : "no-permissions"} sandbox · ` +
			`${outcome.durationMs.toFixed(0)}ms · exit ${outcome.code}`,
	);
	return parts.join("\n");
}

export default defineCommand({
	aliases: ["eval", "ev"],
	description: "Evaluates TypeScript in a throwaway Deno process that has no permissions.",
	category: "owner",
	cooldownMs: 1_000,
	middleware: [ownerOnly],
	args: {
		code: arg.string({
			description: "the code to run, optionally prefixed with --net to allow network access",
			required: true,
			greedy: true,
		}),
	},
	async exec(ctx) {
		const raw = ctx.args.code.trim();
		const networked = NET_FLAG_RE.test(raw);
		const source = stripCodeFence(raw.replace(NET_FLAG_RE, ""));

		if (!source) return void await ctx.error("give me something to run");
		if (source.length > MAX_SOURCE_LENGTH) {
			return void await ctx.error(`that's over ${MAX_SOURCE_LENGTH} characters, trim it down`);
		}

		await ctx.defer();

		const outcome = await runDeno({
			code: wrapSource(source),
			sandbox: networked ? NETWORKED : STRICT,
			timeoutMs: TIMEOUT_MS,
			clearEnv: true,
			env: { NO_COLOR: "1" },
		});

		await ctx.reply({ content: report(outcome, networked) });
	},
});
