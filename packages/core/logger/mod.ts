/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { dim } from "./colours.ts";
import { formatLevelBadge, type LogLevel } from "./levels.ts";

export * from "./colours.ts";
export * from "./badge.ts";

export type LogEntry = {
	level?: LogLevel;
	message: string;
	args: unknown[];
	timestamp?: number;
};

type Formatter = (entry: LogEntry) => string;
type Sink = (entry: LogEntry) => void;

function formatArg(arg: unknown): string {
	if (typeof arg === "string") return arg;
	return Deno.inspect(arg, { colors: true, depth: Infinity, compact: false });
}

const formatter = (entry: LogEntry): string => {
	const ts = dim(`[${new Date(entry.timestamp ?? Date.now()).toLocaleString()}]`);
	const badge = entry.level ? `${formatLevelBadge(entry.level)} ` : "";
	const extra = entry.args.length ? ` ${entry.args.map(formatArg).join(" ")}` : "";
	return `${ts} ${badge}${entry.message}${extra}`;
};

function toJson(value: unknown): unknown {
	if (value instanceof Error) {
		return { name: value.name, message: value.message, stack: value.stack };
	}
	return value;
}

const jsonFormatter = (entry: LogEntry): string => {
	return JSON.stringify({
		level: entry.level,
		message: entry.message,
		args: entry.args.length ? entry.args.map(toJson) : undefined,
		timestamp: entry.timestamp ?? Date.now(),
	});
};

const write = (entry: LogEntry, line: string): void => {
	if (entry.level === "error") console.error(line);
	else console.log(line);
};

const sink = (format: Formatter): Sink => (entry) => {
	try {
		write(entry, format(entry));
	} catch (e) {
		write(entry, `${entry.message} (log formatting failed: ${e})`);
	}
};

let output: Sink = sink(Deno.env.get("LOG_FORMAT") === "json" ? jsonFormatter : formatter);

export function setLogFormat(format: "human" | "json") {
	output = sink(format === "json" ? jsonFormatter : formatter);
}

export interface Logger {
	info(message: string, ...args: unknown[]): void;
	yay(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	boo(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
	prefixed(badge: string, message: string, ...args: unknown[]): void;
	log(entry: LogEntry): void;
	child(fields: Record<string, unknown>): Logger;
}

function createLogger(defaultArgs: unknown[] = []): Logger {
	const log = (level: LogLevel | undefined, message: string, args: unknown[]) => {
		output({ level, message, args: [...defaultArgs, ...args], timestamp: Date.now() });
	};
	return {
		info: (msg, ...args) => log("info", msg, args),
		yay: (msg, ...args) => log("success", msg, args),
		warn: (msg, ...args) => log("warn", msg, args),
		boo: (msg, ...args) => log("error", msg, args),
		debug: (msg, ...args) => log("debug", msg, args),
		prefixed: (badge, msg, ...args) => log(undefined, `${badge} ${msg}`, args),
		log: (entry) => output(entry),
		child: (fields) => createLogger([...defaultArgs, fields]),
	};
}

export function prefixed(badge: string, message: string, metadata?: Record<string, unknown>) {
	logger.info(`${badge} ${message}`, metadata);
}

export const logger: Logger = createLogger();

declare global {
	var logger: Logger;
}

globalThis.logger = logger;
