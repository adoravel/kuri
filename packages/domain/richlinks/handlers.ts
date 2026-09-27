/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { AsyncResult } from "@kuristina/core";
import type { RichLinkProvider } from "@kuristina/database";
import { renderBskyPost } from "@kuristina/embeds/bluesky";
import { renderFediPost } from "@kuristina/embeds/fediverse";
import { renderSnippet as renderForgejo } from "@kuristina/embeds/forgejo";
import { renderSnippet as renderGitHub } from "@kuristina/embeds/github";
import { renderMusicLinkCard } from "@kuristina/embeds/musiclinks";
import { renderTweet } from "@kuristina/embeds/twitter";

import type { Services } from "../services.ts";
import type { LinkHandler, LinkItem, MessagePayload } from "./types.ts";

interface HandlerSpec<T> {
	provider: RichLinkProvider;
	enabled: boolean;
	extract(content: string): T[];
	keyOf(item: T): string;
	render(item: T, signal?: AbortSignal): Promise<MessagePayload | undefined>;
}

function handler<T>(spec: HandlerSpec<T>): LinkHandler {
	return {
		provider: spec.provider,
		enabled: spec.enabled,
		items: (content): LinkItem[] =>
			spec.extract(content).map((item) => ({
				key: spec.keyOf(item),
				render: (signal) => spec.render(item, signal),
			})),
	};
}

async function renderFetched<T>(
	fetch: () => AsyncResult<T, unknown>,
	render: (value: T) => MessagePayload,
	signal?: AbortSignal,
): Promise<MessagePayload | undefined> {
	if (signal?.aborted) return undefined;
	const result = await fetch();
	return result.ok ? render(result.value) : undefined;
}

const identity = (url: string) => url;

const blobKey = (
	ref: { owner: string; repo: string; path: string; ref: string },
	startLine?: number,
	endLine?: number,
	instance?: string,
) =>
	`${instance ? `${instance}/` : ""}${ref.owner}/${ref.repo}/${ref.path}` +
	`#L${startLine ?? ""}-L${endLine ?? ""}@${ref.ref}`;

export function createRichLinkHandlers(services: Services): LinkHandler[] {
	const { config, musicLinks, metadata, twitter, bluesky, github, forgejo, fediverse } = services;
	const embeds = config.modules.linkEmbeds;
	const max = embeds.maxPerMessage;

	const forgejoInstances = embeds.forgejoInstances
		.split(",").map((s) => s.trim()).filter(Boolean);

	return [
		handler({
			provider: "musiclinks",
			enabled: true,
			extract: (content) => musicLinks.extractUrls(content).slice(0, max),
			keyOf: identity,
			render: async (url) => {
				const link = await musicLinks.resolve(url);
				if (!link.ok) return undefined;

				const meta = link.value.artist
					? await metadata.get(link.value.artist, link.value.title, link.value.kind ?? "song")
					: undefined;
				return renderMusicLinkCard(link.value, meta?.ok ? meta.value : undefined);
			},
		}),

		handler({
			provider: "twitter",
			enabled: embeds.twitter,
			extract: (content) => twitter.extractUrls(content).slice(0, max),
			keyOf: identity,
			render: (url, signal) => renderFetched(() => twitter.fetch(url), renderTweet, signal),
		}),

		handler({
			provider: "bluesky",
			enabled: embeds.bluesky,
			extract: (content) => bluesky.extractUrls(content).slice(0, max),
			keyOf: identity,
			render: (url, signal) => renderFetched(() => bluesky.fetch(url), renderBskyPost, signal),
		}),

		handler({
			provider: "fediverse",
			enabled: embeds.fediverse,
			extract: (content) => fediverse.extractUrls(content).slice(0, max),
			keyOf: identity,
			render: (url, signal) => renderFetched(() => fediverse.fetch(url), renderFediPost, signal),
		}),

		handler({
			provider: "github",
			enabled: embeds.github,
			extract: (content) => github.extractBlobRefs(content).slice(0, max),
			keyOf: (ref) => blobKey(ref, ref.startLine, ref.endLine),
			render: async (ref) => {
				const snippet = await github.fetchSnippet(ref);
				if (!snippet.ok) return undefined;

				const meta = await github.fetchRepoMeta(ref.owner, ref.repo);
				return renderGitHub(ref, snippet.value, meta.ok ? meta.value : undefined);
			},
		}),

		handler({
			provider: "forgejo",
			enabled: embeds.forgejo && forgejoInstances.length > 0,
			extract: (content) => forgejo.extractBlobRefs(content, forgejoInstances).slice(0, max),
			keyOf: (ref) => blobKey(ref, ref.startLine, ref.endLine, ref.instance),
			render: async (ref) => {
				const snippet = await forgejo.fetchSnippet(ref);
				if (!snippet.ok) return undefined;

				const meta = await forgejo.fetchRepoMeta(ref.instance, ref.owner, ref.repo);
				return renderForgejo(ref, snippet.value, meta.ok ? meta.value : undefined);
			},
		}),
	].filter((h) => h.enabled);
}
