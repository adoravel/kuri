/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { arg, defineCommand } from "@kuristina/commands/core";
import { assertEditableTable, createPlan, findMatchingRows } from "@kuristina/database/admin";
import { confirmAndApply } from "../../dev/database/shared.tsx";
import { allowedAliasManagers } from "./shared.tsx";

export default defineCommand({
	aliases: ["remove", "rm", "delete"],
	surfaces: "text",
	description: "Removes a Last.fm artist alias from the database.",
	middleware: [allowedAliasManagers()],
	args: {
		alias: arg.string({ description: "the alias name to remove", required: true }),
	},
	async exec(ctx) {
		try {
			assertEditableTable("artist_aliases");
		} catch (e) {
			return void await ctx.error((e as Error).message);
		}

		const alias = ctx.args.alias.trim();
		const filter = { name_key: alias.toLowerCase() };

		const before = await findMatchingRows(ctx.services.db, "artist_aliases", filter, 1);
		if (!before.length) return void await ctx.error(`no alias found for "${alias}"`);

		const plan = createPlan(`remove alias "${alias}"`, [{
			table: "artist_aliases",
			pk: filter,
			before: before[0],
			after: null,
		}]);

		await confirmAndApply(ctx, plan);
	},
});
