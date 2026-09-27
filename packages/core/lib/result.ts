/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export type Ok<T> = {
	readonly ok: true;
	readonly value: T;
};

export type Err<E> = {
	readonly ok: false;
	readonly error: E;
};

export type Result<T, E = never> = Ok<T> | Err<E>;

export type AsyncResult<T, E = never> = Promise<Result<T, E>>;

export const ok = <T>(value: T): Result<T, never> => ({
	ok: true,
	value,
});

export const err = <E>(error: E): Result<never, E> =>
	({
		ok: false,
		error,
	}) as Result<never, E>;

export function discard<E>(result: Result<any, E>): Result<void, E> {
	return result.ok ? ok(undefined) : result;
}
