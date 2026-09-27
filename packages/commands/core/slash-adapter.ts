/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
	ApplicationCommandOptionTypes,
	type CreateApplicationCommand,
	DiscordApplicationIntegrationType,
	DiscordInteractionContextType,
	InteractionResponseTypes,
	InteractionTypes,
	MessageFlags,
} from "@discordeno/types";
import {
	ackWithMessage,
	type DiscordBot,
	type Interaction,
	resolveChannel,
	resolveGuild,
} from "@kuristina/discord-bot";

import type { ArgsShape, CommandSpec, InferArgs } from "./spec.ts";
import type { ArgDef, AutocompleteHandler } from "./argument.ts";
import { type InvocationBase, withReplyHelpers } from "./invocation.tsx";
import { computeSnowflakeTimestamp } from "./snowflake.ts";
import { classifyContext, type CommandContextKind, isContextAllowed } from "./context-kind.ts";
import type { Middleware } from "./middleware.ts";
import { wrapExecution } from "./execution.ts";
import { bg, createBadge, fg } from "@kuristina/core";
import { getGlobalMiddleware, slashCommands } from "./registry.ts";
import type { Services } from "@kuristina/domain/services";

const slashBadge = createBadge({ label: "/command", bg: bg("#5865f2"), fg: fg("#ffffff") });

const CONTEXT_MAP: Record<CommandContextKind, DiscordInteractionContextType> = {
	guild: DiscordInteractionContextType.Guild,
	bot_dm: DiscordInteractionContextType.BotDm,
	private_channel: DiscordInteractionContextType.PrivateChannel,
};

interface RawOption {
	name: string;
	type?: ApplicationCommandOptionTypes;
	value?: unknown;
	options?: RawOption[];
	focused?: boolean;
}

function buildInvocationBase<A>(
	platform: DiscordBot,
	interaction: Interaction,
	args: A,
	services: Services,
): InvocationBase<A> {
	let acked = false;

	return {
		surface: "slash",
		args,
		user: interaction.user,
		member: interaction.member,
		guildId: interaction.guildId,
		channelId: interaction.channelId!,
		platform,
		invokedAt: computeSnowflakeTimestamp(interaction.id),
		getGuild: () =>
			interaction.guildId
				? resolveGuild(platform, interaction.guildId)
				: Promise.resolve(undefined),
		getChannel: () =>
			interaction.channelId
				? resolveChannel(platform, interaction.channelId)
				: Promise.resolve(undefined),
		raw: { kind: "slash", interaction },
		defer: async (opts) => {
			if (acked) return;
			acked = true;
			await platform.helpers.sendInteractionResponse(interaction.id, interaction.token, {
				type: InteractionResponseTypes.DeferredChannelMessageWithSource,
				data: opts?.ephemeral ? { flags: MessageFlags.Ephemeral } : undefined,
			}).catch((e) => {
				acked = false;
				logger.warn("slash defer failed:", e);
			});
		},
		reply: async (content, opts): Promise<undefined> => {
			try {
				if (acked) {
					await platform.helpers.editOriginalInteractionResponse(interaction.token, content);
				} else {
					acked = true;
					await ackWithMessage(platform, interaction, { ...content, ephemeral: opts?.ephemeral });
				}
			} catch (e) {
				logger.warn("slash reply failed:", e);
			}
		},
		services,
	};
}

function enforceDescriptionLimit(description: string, context: string): string {
	if (description.length <= 100) return description;
	logger.warn(`slash: description for "${context}" exceeds 100 chars! Truncating.`);
	return description.slice(0, 97) + "...";
}

function toSlashOption(name: string, def: ArgDef<unknown>) {
	return {
		name,
		description: enforceDescriptionLimit(def.description, `option ${name}`),
		type: def.slashType,
		required: def.required,
		choices: def.choices,
		minValue: def.minValue,
		maxValue: def.maxValue,
		minLength: def.minLength,
		maxLength: def.maxLength,
		autocomplete: def.autocomplete ? true : undefined,
	};
}

export interface CompiledSlashCommand {
	readonly registration: CreateApplicationCommand;
	readonly autocomplete: ReadonlyMap<string, AutocompleteHandler>;

	dispatch(bot: DiscordBot, interaction: Interaction, services: Services): Promise<void>;
}

const isArgumentInclusive = <A, B extends boolean>(def: ArgDef<A, B>) =>
	def.surfaces == null || def.surfaces.includes("both") || def.surfaces.includes("slash");

function getArgs<A extends ArgsShape = ArgsShape>(spec: CommandSpec<A>) {
	return Object.entries(spec.args ?? {}).filter(([_, def]) => isArgumentInclusive(def));
}

function getLeafOptions<A extends ArgsShape = ArgsShape>(spec: CommandSpec<A>) {
	return getArgs(spec).map(([name, def]) => toSlashOption(name, def as ArgDef<unknown>));
}

function buildOptionsFor(spec: CommandSpec<any>): unknown[] {
	if (!spec.subcommands?.length) return getLeafOptions(spec);

	return spec.subcommands.map((sub) => {
		if (sub.subcommands?.length) {
			return {
				name: sub.aliases[0],
				description: enforceDescriptionLimit(sub.description, `group ${sub.aliases[0]}`),
				type: ApplicationCommandOptionTypes.SubCommandGroup,
				options: buildOptionsFor(sub),
			};
		}
		return {
			name: sub.aliases[0],
			description: enforceDescriptionLimit(sub.description, `subcommand ${sub.aliases[0]}`),
			type: ApplicationCommandOptionTypes.SubCommand,
			options: getLeafOptions(sub),
		};
	});
}

interface ResolvedCommand {
	spec: CommandSpec<any>;
	leafOptions: RawOption[] | undefined;
	middleware: Middleware[];
}

function resolveInvokedSpec(
	root: CommandSpec<any>,
	options: RawOption[] | undefined,
): ResolvedCommand {
	let spec = root;
	let opts = options;
	const middleware: Middleware[] = [...getGlobalMiddleware(), ...root.middleware];

	while (
		opts?.length === 1 &&
		(opts[0].type === ApplicationCommandOptionTypes.SubCommand ||
			opts[0].type === ApplicationCommandOptionTypes.SubCommandGroup)
	) {
		const next = spec.subcommands?.find((s) => s.aliases[0] === opts![0].name);
		if (!next) break;
		spec = next;
		opts = opts[0].options;
		middleware.push(...spec.middleware);
	}

	return { spec, leafOptions: opts, middleware };
}

function extractArgs<A extends ArgsShape>(
	spec: CommandSpec<A>,
	options: RawOption[] | undefined,
): { ok: true; args: InferArgs<A> } | { ok: false; argName: string; message: string } {
	const raw = new Map((options ?? []).map((o) => [o.name, o.value]));
	const out: Record<string, unknown> = {};

	const args = getArgs<A>(spec);
	for (const [name, def] of args) {
		if (!raw.has(name)) continue;
		try {
			out[name] = def.fromSlashValue ? def.fromSlashValue(raw.get(name)) : raw.get(name);
		} catch (e) {
			return { ok: false, argName: name, message: e instanceof Error ? e.message : String(e) };
		}
	}

	return { ok: true, args: out as InferArgs<A> };
}

const hasContext = (contexts: readonly string[] | undefined, allowed: string[]) =>
	!contexts || contexts.some((c) => allowed.includes(c));

export function toSlashCommand<A extends ArgsShape>(spec: CommandSpec<A>): CompiledSlashCommand {
	const registration: CreateApplicationCommand = {
		name: spec.aliases[0],
		description: enforceDescriptionLimit(spec.description, `command ${spec.aliases[0]}`),
		options: buildOptionsFor(spec) as CreateApplicationCommand["options"],
		contexts: spec.contexts?.map((c) => CONTEXT_MAP[c]),
		integrationTypes: [
			...(hasContext(spec.contexts, ["guild", "both"])
				? [DiscordApplicationIntegrationType.GuildInstall]
				: []),
			...(hasContext(spec.contexts, ["private_channel", "bot_dm", "both"])
				? [DiscordApplicationIntegrationType.UserInstall]
				: []),
		],
	};
	const autocomplete = new Map<string, AutocompleteHandler>();
	collectAutocomplete(spec, [], autocomplete);

	return {
		registration,
		autocomplete,
		async dispatch(bot, interaction, services) {
			const start = performance.now();
			const actual = classifyContext({ guildId: interaction.guildId, dm: !interaction.guildId });

			if (!isContextAllowed(spec.contexts, actual)) {
				return await respond(interaction, "This command isn't available here.", true);
			}

			const { spec: invoked, leafOptions, middleware } = resolveInvokedSpec(
				spec,
				interaction.data?.options as RawOption[] | undefined,
			);

			const extracted = extractArgs(invoked, leafOptions);
			if (!extracted.ok) {
				return await respond(
					interaction,
					`invalid value for \`${extracted.argName}\`: ${extracted.message}`,
					true,
				);
			}

			const invocation = withReplyHelpers(
				buildInvocationBase(bot, interaction, extracted.args, services),
			);

			const actualForInvoked = classifyContext({
				guildId: interaction.guildId,
				dm: !interaction.guildId,
			});
			if (!isContextAllowed(invoked.contexts, actualForInvoked)) {
				return await respond(interaction, "This command isn't available here.", true);
			}

			try {
				const path = computePath(spec, invoked);
				await wrapExecution(
					{ invocation, path, badge: slashBadge, start },
					middleware,
					() => invoked.exec(invocation),
				);
			} catch {
				await invocation.reply({ content: "Something went wrong running this command." }).catch(
					() => {},
				);
			}
		},
	};
}

function collectAutocomplete(
	spec: CommandSpec<any>,
	pathSoFar: string[],
	out: Map<string, AutocompleteHandler>,
): void {
	const args = getArgs(spec);
	for (const [name, def] of args) {
		if (def.autocomplete) out.set([...pathSoFar, name].join("."), def.autocomplete);
	}
	for (const sub of spec.subcommands ?? []) {
		collectAutocomplete(sub, [...pathSoFar, sub.aliases[0]], out);
	}
}

export async function dispatchAutocomplete(
	bot: DiscordBot,
	compiled: CompiledSlashCommand,
	interaction: Interaction,
): Promise<void> {
	let opts = (interaction.data?.options ?? []) as RawOption[];
	const pathParts: string[] = [];

	while (
		opts.length === 1 &&
		(opts[0].type === ApplicationCommandOptionTypes.SubCommand ||
			opts[0].type === ApplicationCommandOptionTypes.SubCommandGroup)
	) {
		pathParts.push(opts[0].name);
		opts = opts[0].options ?? [];
	}

	const focused = opts.find((o) => o.focused);
	if (!focused) return;

	const handler = compiled.autocomplete.get([...pathParts, focused.name].join("."));
	if (!handler) return;

	const rawArgs = Object.fromEntries(opts.map((o) => [o.name, o.value]));
	const choices = await handler({
		input: String(focused.value ?? ""),
		partialArgs: rawArgs,
		userId: interaction.user.id,
		guildId: interaction.guildId,
	}).catch((error) => {
		logger.boo(`autocomplete handler error (${[...pathParts, focused.name].join(" ")}):`, error);
		return [];
	});

	await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
		type: InteractionResponseTypes.ApplicationCommandAutocompleteResult,
		data: { choices: choices.slice(0, 25) },
	});
}

function computePath(root: CommandSpec<any>, target: CommandSpec<any>): string[] {
	if (root === target) return [root.aliases[0]];
	for (const sub of root.subcommands ?? []) {
		const found = computePath(sub, target);
		if (found.length) return [root.aliases[0], ...found];
	}
	return [];
}

async function respond(
	interaction: Interaction,
	content: string,
	ephemeral: boolean,
): Promise<void> {
	await (interaction as unknown as { respond: (..._: any[]) => Promise<void> })
		.respond({ content }, { isPrivate: ephemeral }).catch(() => {});
}

export async function dispatchSlashInteraction(
	bot: DiscordBot,
	interaction: Interaction,
	services: Services,
): Promise<void> {
	const name = interaction.data?.name;
	if (!name) return;

	const entry = slashCommands.get(name);
	if (!entry) return;

	if (interaction.type === InteractionTypes.ApplicationCommandAutocomplete) {
		await dispatchAutocomplete(bot, entry.compiled, interaction);
	} else if (interaction.type === InteractionTypes.ApplicationCommand) {
		await entry.compiled.dispatch(bot, interaction, services);
	}
}
