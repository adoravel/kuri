/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

const FENCE_RE = /^```(?:[a-z]*)\r?\n([\s\S]*?)\r?\n?```$/i;

const TRAILING_SEMICOLON_RE = /;+\s*$/;
const STATEMENT_START_RE =
	/^(?:const|let|var|function|class|import|export|return|throw|if|for|while|do|switch|try|debugger|using)\b/;

export const NET_FLAG_RE = /^--net(?=\s)\s*/;

export function stripCodeFence(input: string): string {
	const trimmed = input.trim();
	return trimmed.match(FENCE_RE)?.[1].trim() ?? trimmed;
}

export function wrapSource(source: string): string {
	const single = source.replace(TRAILING_SEMICOLON_RE, "");
	const isExpression = !single.includes("\n") && !single.includes(";") &&
		!STATEMENT_START_RE.test(single);

	return `
const __run = async () => {
${isExpression ? `return (${single});` : source}
};
const __value = await __run();
if (__value !== undefined) console.log(Deno.inspect(__value, { depth: 4, colors: false }));
`;
}
