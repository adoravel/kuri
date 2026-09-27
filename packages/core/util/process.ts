/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface SpawnOptions {
	readonly args?: readonly string[];
	readonly cwd?: string;
	readonly env?: Record<string, string>;
	readonly clearEnv?: boolean;
	readonly stdin?: string;
	readonly timeoutMs?: number;
}

export interface SpawnOutcome {
	readonly code: number;
	readonly success: boolean;
	readonly stdout: string;
	readonly stderr: string;
	readonly timedOut: boolean;
	readonly durationMs: number;
}

const decoder = new TextDecoder();

export async function spawn(command: string, options: SpawnOptions = {}): Promise<SpawnOutcome> {
	const { args = [], cwd, env, clearEnv, stdin, timeoutMs } = options;
	const started = performance.now();

	const child = new Deno.Command(command, {
		args: [...args],
		cwd,
		env,
		clearEnv,
		stdin: stdin === undefined ? "null" : "piped",
		stdout: "piped",
		stderr: "piped",
	}).spawn();

	if (stdin !== undefined) {
		const writer = child.stdin.getWriter();
		await writer.write(new TextEncoder().encode(stdin));
		await writer.close();
	}

	let timedOut = false;
	const timer = timeoutMs === undefined ? undefined : setTimeout(() => {
		timedOut = true;
		try {
			child.kill("SIGKILL");
		} catch { /* already gone */ }
	}, timeoutMs);

	try {
		const { code, stdout, stderr } = await child.output();
		return {
			code,
			success: code === 0 && !timedOut,
			stdout: decoder.decode(stdout).trimEnd(),
			stderr: decoder.decode(stderr).trimEnd(),
			timedOut,
			durationMs: performance.now() - started,
		};
	} finally {
		clearTimeout(timer);
	}
}

export type SandboxPermission = "read" | "write" | "net" | "env" | "run" | "sys" | "ffi" | "import";

export type Sandbox = Partial<Record<SandboxPermission, readonly string[] | true>>;

export function sandboxFlags(sandbox: Sandbox): string[] {
	const flags = ["--no-prompt"];
	for (const [permission, grant] of Object.entries(sandbox)) {
		if (grant === true) flags.push(`--allow-${permission}`);
		else if (grant?.length) flags.push(`--allow-${permission}=${grant.join(",")}`);
	}
	return flags;
}

export interface DenoRunOptions extends Omit<SpawnOptions, "args" | "stdin"> {
	readonly sandbox?: Sandbox;
	readonly scriptArgs?: readonly string[];
	readonly code?: string;
	readonly script?: string;
	readonly inheritConfig?: boolean;
}

export function runDeno(options: DenoRunOptions): Promise<SpawnOutcome> {
	const { sandbox = {}, scriptArgs = [], code, script, inheritConfig, ...spawnOptions } = options;
	if ((code === undefined) === (script === undefined)) {
		throw new TypeError("runDeno() needs exactly one of `code` or `script`");
	}

	const args = [
		"run",
		...(inheritConfig ? [] : ["--no-config", "--no-lock"]),
		...sandboxFlags(sandbox),
		"--quiet",
		...(code === undefined ? [script!] : ["--ext=ts", "-"]),
		...scriptArgs,
	];

	return spawn(Deno.execPath(), { ...spawnOptions, args, stdin: code });
}
