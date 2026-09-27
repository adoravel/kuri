/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Result } from "./result.ts";

export type UnwrappedVal<T> = T extends { value: infer V } ? UnwrappedVal<V>
	: Awaited<T> extends { ok: true; value: infer U } ? U
	: Awaited<T> extends { ok: false } ? never
	: Awaited<T> extends Result<infer U, any> ? U
	: Awaited<T>;

export type UnwrappedErr<T> = T extends { value: infer V } ? UnwrappedErr<V>
	: Awaited<T> extends { ok: false; error: infer E } ? E
	: Awaited<T> extends { ok: true } ? never
	: Awaited<T> extends Result<any, infer E> ? E
	: never;

export type IsAsync<T> = T extends { value: infer V } ? IsAsync<V>
	: Awaited<T> extends Promise<any> ? true
	: T extends Promise<any> ? true
	: false;
