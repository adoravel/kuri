/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CreateMessageOptions, Message } from "@kuristina/discord-bot";
import { type DiscordBot, resolveChannel, resolveGuild } from "@kuristina/discord-bot";

import type { CommandSpec } from "./spec.ts";
import { type InvocationBase, withReplyHelpers } from "./invocation.tsx";
import { computeSnowflakeTimestamp } from "./snowflake.ts";
import { classifyContext, isContextAllowed } from "./context-kind.ts";
import { buildTextArgsParser, prefix, StringStream } from "./text-args.ts";
import { infer, word } from "@kuristina/commands";
import type { ArgDef } from "./argument.ts";
import type { Middleware } from "./middleware.ts";
import { bg, createBadge, fg, type Mutable } from "@kuristina/core";
import { wrapExecution } from "./execution.ts";
import { getGlobalMiddleware } from "./registry.ts";
import type { Services } from "@kuristina/domain/services";

const topLevel = new Map<string, CommandSpec<any>>();

const textBadge = createBadge({ label: "command", bg: bg("#ec4899"), fg: fg("#000000") });

export function registerTextCommand(spec: CommandSpec<any>): void {
	for (const alias of spec.aliases) {
		if (topLevel.has(alias)) throw new Error(`command alias "${alias}" is already registered`);
		topLevel.set(alias, spec);
	}
}

interface ResolvedCommand {
	spec: CommandSpec<any>;
	path: string[];
	middleware: Middleware[];
}

function resolve(root: CommandSpec<any>, stream: StringStream): ResolvedCommand {
	let spec = root;
	const path = [root.aliases[0]];
	const middleware: Middleware[] = [...getGlobalMiddleware(), ...root.middleware];

	while (spec.subcommands?.length) {
		stream.push();
		stream.skipWhitespace();
		const name = word(stream);
		if (!infer("success")(name)) {
			stream.restore();
			break;
		}
		const sub = spec.subcommands.find((s) => s.aliases.includes(name.data.toLowerCase()));
		if (!sub) {
			stream.restore();
			break;
		}
		stream.pop();
		spec = sub;
		path.push(sub.aliases[0]);
		middleware.push(...sub.middleware);
	}

	return { spec, path, middleware };
}

async function buildTextInvocationBase<A>(
	platform: DiscordBot,
	message: Message,
	args: A,
	mightBeEdit: boolean,
	services: Services,
): Promise<InvocationBase<A>> {
	const companions = services.repos.messageCompanions;
	let responseId: bigint | undefined;
	let reinvoking = false;

	if (mightBeEdit) {
		const prior = await companions.getForSource(message.id, "command");
		if (prior.ok && prior.value.length) {
			responseId = prior.value[0].responseMessageId;
			reinvoking = true;
		}
	}

	function ensureMessageReference(opts: CreateMessageOptions): void {
		if (opts.messageReference) return;
		opts.messageReference = {
			messageId: message.id,
			channelId: message.channelId,
			failIfNotExists: false,
			...(message.guildId ? { guildId: message.guildId } : {}),
		};
	}

	async function sendOrEdit(opts: CreateMessageOptions) {
		if (!responseId) {
			ensureMessageReference(opts);

			const response = await platform.helpers.sendMessage(message.channelId, opts);
			await companions.add(
				message.id,
				responseId = response.id,
				message.channelId,
				"command",
			);
			return { id: response.id, channelId: response.channelId };
		}

		try {
			const edit = await platform.helpers.editMessage(message.channelId, responseId, opts);
			await companions.add(message.id, edit.id, message.channelId, "command");
			return { id: edit.id, channelId: edit.channelId };
		} catch (e) {
			if ((e as any)?.code === 10008 /* unknown message */) {
				responseId = undefined;
				return await sendOrEdit(opts);
			}
			throw e;
		}
	}

	return {
		surface: "text",
		args,
		user: message.author,
		member: message.member,
		guildId: message.guildId,
		channelId: message.channelId,
		platform,
		invokedAt: computeSnowflakeTimestamp(message.id),
		getGuild: () =>
			message.guildId ? resolveGuild(platform, message.guildId) : Promise.resolve(undefined),
		getChannel: () => resolveChannel(platform, message.channelId),
		raw: { kind: "text", message, isReinvocation: reinvoking },
		defer: async () => {
			await platform.helpers.triggerTypingIndicator(message.channelId).catch(() => {});
		},
		reply: sendOrEdit,
		services,
	};
}

async function cleanupStaleReply(
	platform: DiscordBot,
	message: Message,
	services: Services,
): Promise<void> {
	const companions = services.repos.messageCompanions;

	const stale = await companions.getForSource(message.id, "command");
	if (!stale.ok || !stale.value.length) return;

	await Promise.all(
		stale.value.map((c) =>
			platform.helpers.deleteMessage(c.channelId, c.responseMessageId).catch(() => {})
		),
	);
	await companions.deleteForSource(message.id, "command");
}

export async function executeTextCommand(
	platform: DiscordBot,
	message: Message,
	stream: StringStream,
	services: Services,
): Promise<void> {
	const isEdit = message.editedTimestamp != null;

	const prefixResult = prefix(stream);
	if (!infer("success")(prefixResult)) {
		if (isEdit) await cleanupStaleReply(platform, message, services);
		return;
	}
	const start = performance.now();

	const name = word(stream);
	if (!infer("success")(name)) return;

	const root = topLevel.get(name.data.toLowerCase());
	if (!root) return;

	const { spec, path, middleware } = resolve(root, stream);
	const { args, parser: argsParser } = buildTextArgsParser(spec.args ?? {});
	const parsed = argsParser(stream);

	const base = await buildTextInvocationBase(platform, message, {}, isEdit, services);

	if (!infer("success")(parsed)) {
		const invocation = withReplyHelpers(base);
		await invocation.error(`couldn't parse that command: ${parsed.data.message}`);
		return;
	}

	const argsRecord: Record<string, unknown> = { ...parsed.data.args };
	for (const [name, $def] of Object.entries(args)) {
		const def = $def as ArgDef<any>;
		if (def.greedy && !(name in argsRecord)) {
			const restParsed = def.textParser(new StringStream(parsed.data.remaining));
			if (infer("success")(restParsed)) argsRecord[name] = restParsed.data;
			else if (def.required) {
				const invocation = withReplyHelpers(base);
				await invocation.error(`missing required argument: ${name}`);
				return;
			}
		}
	}

	(base as Mutable<InvocationBase<any>>).args = argsRecord;
	const invocation = withReplyHelpers(base);

	const actual = classifyContext({ guildId: message.guildId, dm: !message.guildId });
	if (!isContextAllowed(spec.contexts, actual)) return;

	for (const mid of middleware) {
		const result = await mid.execute(invocation);
		if (result.type !== "continue") return;
	}

	try {
		await wrapExecution(
			{ invocation, path, start, badge: textBadge },
			middleware,
			() => spec.exec(invocation),
		);
	} catch {
		await invocation.error(
			"That command hit an error. Try again in a moment, or ping the retard in chief if it keeps happening.",
		);
	}
}
