/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { colour, defineCommand } from "@kuristina/commands/core";
import type { DiscordBot, Guild, Interaction, Role } from "@kuristina/discord-bot";
import { safe, waitForInteraction } from "@kuristina/core";

const ROLE_MARKER = ".ᐟ〃" as const;

const encode = (id: bigint): string =>
	[...String(id)].map((c) => {
		const p = c.codePointAt(0)!;
		return p < 0x80 && p > 0 ? String.fromCodePoint(p + 0xE0000) : c;
	}).join("");

const isColourRole = (role: Role): boolean => role.name.startsWith(ROLE_MARKER);
const isPersonalRole = (role: Role, id: bigint): boolean => role.name === encode(id);

const RoleCard = ({ roles, customId }: {
	roles: Role[];
	customId: string;
}) => {
	return (
		<message>
			<h3>Role colours</h3>
			<hr spacing={2} />
			<p>_woah you're so colorful~_</p>
			{roles.length > 0
				? (
					<row>
						<select
							customId={customId}
							placeholder="Select a colour preset"
							maxValues={1}
						>
							{roles.map((role) => (
								<option
									value={role.id.toString()}
									description={`#${
										(role.colors?.primaryColor ?? role.color)?.toString(16)?.padStart(6, "0") ??
											"<unknown>"
									}`}
									emoji={role.unicodeEmoji ? { name: role.unicodeEmoji } : undefined}
								>
									{role.name}
								</option>
							))}
						</select>
					</row>
				)
				: <p>_No color presets available yet!_</p>}
			<hr spacing={2} />
			<sub>
				• Pro tip: You can pick an arbitrary colour by running{"  "}
				<kbd>kuristina colour &lt;colour_code&gt;</kbd>.
			</sub>
			<sub>
				• Example: <kbd>kuristina colour #FF69B4</kbd> for hot pink.
			</sub>
		</message>
	);
};

const findPersonalRole = (guild: Guild, userId: bigint): Role | undefined =>
	guild.roles.find((r) => r.name === encode(userId));

const removeColourRoles = (
	bot: DiscordBot,
	guild: Guild,
	userId: bigint,
	memberRoles: bigint[],
) =>
	Promise.all(
		guild.roles
			.filter((r) =>
				(isColourRole(r) || isPersonalRole(r, userId)) &&
				memberRoles.includes(r.id)
			)
			.map((r) => bot.helpers.removeRole(guild.id, userId, r.id, "colour role update")),
	);

async function assignColourRole(
	bot: DiscordBot,
	guild: Guild,
	userId: bigint,
	color: number,
): Promise<Role> {
	const existing = findPersonalRole(guild, userId);

	const role = existing
		? await bot.helpers.editRole(
			guild.id,
			existing.id,
			{ colors: { primaryColor: color } },
			"arbitrary colour role update",
		)
		: await bot.helpers.createRole(guild.id, { name: encode(userId), color }, "colour role");

	await bot.helpers.addRole(guild.id, userId, role.id, "arbitrary colour role update");
	return role;
}

async function handleColourSelection(
	bot: DiscordBot,
	guild: Guild,
	userId: bigint,
	roleId: bigint,
): Promise<void> {
	await removeColourRoles(bot, guild, userId, guild.members.get(userId)?.roles ?? []);
	await bot.helpers.addRole(guild.id, userId, roleId, "selected colour preset");
}

export default defineCommand({
	aliases: ["colour", "color", "role-color", "role-colour", "role", "hx"],
	description: "Allows the user to set an arbitrary colour as their role.",
	category: "utility",
	contexts: ["guild"],
	args: {
		value: colour({
			description: "Hex, named, or rgb()/hsl() colours",
			required: false,
			greedy: true,
		}),
	},
	async exec(ctx) {
		const bot = ctx.platform;
		const guild = await ctx.getGuild();
		if (!guild) return void await ctx.error("guild context is uninitialised");

		if (ctx.args.value !== undefined) {
			const applied = await safe(async () => {
				await removeColourRoles(bot, guild, ctx.user.id, ctx.member?.roles ?? []);
				return await assignColourRole(bot, guild, ctx.user.id, ctx.args.value!);
			});
			if (!applied.ok) {
				return void await ctx.error(`couldn't set your colour role: ${applied.error.message}`);
			}
			await ctx.reply({ content: `-# <@&${applied.value.id}>` });
			return;
		}

		const { customId, promise } = waitForInteraction<Interaction>("role-colour", 60_000 * 3.5, {
			filter: (i) => i.user?.id === ctx.user.id,
		});

		const roles = await bot.helpers.getRoles(guild.id);
		const answer = await ctx.reply(
			<RoleCard customId={customId} roles={roles.filter(isColourRole)} />,
			{ ephemeral: true },
		);

		const interaction = await promise.catch(() => undefined);
		if (!interaction || !interaction.data) return;

		const selectedRoleId = interaction.data.values?.[0];
		if (!selectedRoleId) return;

		const roleId = BigInt(selectedRoleId);
		const selectedRole = guild.roles.get(roleId);
		if (!selectedRole) {
			await ctx.reply({ content: "This role no longer exists." });
			return;
		}

		const applied = await safe(() => handleColourSelection(bot, guild, ctx.user.id, roleId));
		if (!applied.ok) {
			return void await ctx.error("couldn't apply that colour, sorry. ermm try again mayhaps?");
		}

		await interaction.respond({ content: `-# <@&${roleId}>` }, { isPrivate: true });
		if (answer) {
			bot.helpers.deleteMessage(answer.channelId, answer.id).catch(() => undefined);
		}
	},
});
