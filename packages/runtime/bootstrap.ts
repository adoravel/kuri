/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { pipe } from "@kuristina/core";
import { loadConfig } from "@kuristina/config";
import { closeDatabase, createDatabase, initDatabase } from "@kuristina/database";
import type { Services } from "@kuristina/domain/services";
import { createServices } from "./services.ts";

export interface SurfaceHandle {
	shutdown(): Promise<void>;
}

export type Surface = (services: Services) => Promise<SurfaceHandle>;

const SIGNALS = ["SIGINT", "SIGTERM"] as const;

function reportFatal(label: string, error: unknown): void {
	console.error(`[fatal] ${label}:`, error);
	try {
		logger.boo(label, error);
	} catch (e) {
		console.error(`[fatal] logger itself failed while reporting the above:`, e);
	}
}

globalThis.addEventListener("error", (event) => {
	reportFatal("uncaught error", event.error ?? event.message);
});

globalThis.addEventListener("unhandledrejection", (event) => {
	reportFatal("unhandled rejection", event.reason);
});

function onceOnShutdown(teardown: (signal: string) => Promise<void>): void {
	let shuttingDown = false;

	const handle = (signal: string) => {
		if (shuttingDown) return;
		shuttingDown = true;

		logger.info(`received ${signal}, shutting down...`);
		teardown(signal)
			.then(() => logger.info("goodbye :3"))
			.catch((e) => logger.boo("shutdown failed:", e))
			.finally(() => Deno.exit(0));
	};

	for (const signal of SIGNALS) Deno.addSignalListener(signal, () => handle(signal));
}

interface SurfaceOutcome {
	readonly name: string;
	readonly result: PromiseSettledResult<SurfaceHandle>;
}

async function startOne(
	name: string,
	start: () => Promise<SurfaceHandle>,
): Promise<SurfaceOutcome> {
	try {
		const value = await start();
		logger.yay(`${name} started`);
		return { name, result: { status: "fulfilled", value } };
	} catch (reason) {
		logger.boo(`${name} failed to start:`, reason);
		return { name, result: { status: "rejected", reason } };
	}
}

async function startSurfaces(
	surfaces: readonly Surface[],
	services: Services,
): Promise<SurfaceOutcome[]> {
	return await Promise.all(
		surfaces.map((surface) => {
			const name = surface.name || "surface";
			logger.info(`starting ${name}...`);
			return startOne(name, () => surface(services));
		}),
	);
}

export async function bootstrap(...surfaces: readonly Surface[]): Promise<void> {
	logger.info("starting up...");

	const loaded = await pipe(loadConfig())
		.flatMap((config) => {
			logger.info("config loaded, opening database...");
			const db = createDatabase(config.sqlite.path);
			return pipe(initDatabase(db)).map(() => ({ config, db }));
		})
		.value;

	if (!loaded.ok) {
		logger.boo("failed to start:", loaded.error);
		Deno.exit(1);
	}

	const { config, db } = loaded.value;
	logger.yay("database ready");

	const services = createServices(config, db);
	const outcomes = await startSurfaces(surfaces, services);

	const handles = outcomes
		.map((o) => o.result)
		.filter((r): r is PromiseFulfilledResult<SurfaceHandle> => r.status === "fulfilled")
		.map((r) => r.value);

	if (!handles.length) {
		logger.boo("every surface failed to start, shutting down");
		await closeDatabase(db);
		Deno.exit(1);
	}

	const failed = outcomes.filter((o) => o.result.status === "rejected");
	if (failed.length) {
		logger.warn(
			`continuing with ${handles.length}/${outcomes.length} surface(s); ` +
				`${failed.map((o) => o.name).join(", ")} did not start`,
		);
	}

	onceOnShutdown(async () => {
		await Promise.allSettled(handles.map((handle) => handle.shutdown()));
		await closeDatabase(db);
	});
}
