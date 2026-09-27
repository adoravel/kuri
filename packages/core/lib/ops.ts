/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Errors, type NetworkError } from "../errors.ts";
import { type AsyncResult, err, ok, type Result } from "./result.ts";
import type { IsAsync, UnwrappedErr, UnwrappedVal } from "./helpers.ts";

export function flatMap<T, E>(
	input: Result<T, E>,
): <Ret>(
	fn: (value: T) => Ret,
) => IsAsync<Ret> extends true ? AsyncResult<UnwrappedVal<Ret>, E | UnwrappedErr<Ret>>
	: Result<UnwrappedVal<Ret>, E | UnwrappedErr<Ret>>;
export function flatMap<T, E>(
	input: AsyncResult<T, E>,
): <Ret>(
	fn: (value: T) => Ret,
) => AsyncResult<UnwrappedVal<Ret>, E | UnwrappedErr<Ret>>;
export function flatMap(input: any) {
	return function (fn: any): any {
		return input instanceof Promise
			? input.then((r) => r.ok ? fn(r.value) : err(r.error))
			: input.ok
			? fn(input.value)
			: err(input.error);
	};
}

export function map<T, E>(input: Result<T, E>): <U>(fn: (value: T) => U) => Result<U, E>;
export function map<T, E>(input: AsyncResult<T, E>): <U>(fn: (value: T) => U) => AsyncResult<U, E>;
export function map(input: any) {
	return function (fn: any): any {
		return input instanceof Promise
			? input.then((r) => r.ok ? ok(fn(r.value)) : err(r.error))
			: input.ok
			? ok(fn(input.value))
			: err(input.error);
	};
}

export function flatMapError<T, E>(
	input: Result<T, E>,
): <Ret>(
	fn: (error: E) => Ret,
) => IsAsync<Ret> extends true ? AsyncResult<T | UnwrappedVal<Ret>, UnwrappedErr<Ret>>
	: Result<T | UnwrappedVal<Ret>, UnwrappedErr<Ret>>;
export function flatMapError<T, E>(
	input: AsyncResult<T, E>,
): <Ret>(
	fn: (error: E) => Ret,
) => AsyncResult<T | UnwrappedVal<Ret>, UnwrappedErr<Ret>>;
export function flatMapError(input: any) {
	return function (fn: any): any {
		return input instanceof Promise
			? input.then((r) => (r.ok ? r : fn(r.error)))
			: input.ok
			? input
			: fn(input.error);
	};
}

export function and<T, E>(
	input: Result<T, E>,
): <Other>(
	other: Other,
) => IsAsync<Other> extends true ? AsyncResult<T & UnwrappedVal<Other>, E | UnwrappedErr<Other>>
	: Result<T & UnwrappedVal<Other>, E | UnwrappedErr<Other>>;
export function and<T, E>(
	input: AsyncResult<T, E>,
): <Other>(
	other: Other,
) => AsyncResult<T & UnwrappedVal<Other>, E | UnwrappedErr<Other>>;
export function and(input: any) {
	const combine = (r1: Result<any, any>, r2: Result<any, any>): Result<any, any> => {
		if (!r1.ok) return err(r1.error);
		if (!r2.ok) return err(r2.error);
		const combined = (typeof r1.value === "object" && r1.value !== null)
			? { ...r1.value, ...r2.value }
			: r2.value;
		return ok(combined);
	};

	return function (other: any): any {
		if (input instanceof Promise) {
			return input.then((r1) =>
				other instanceof Promise ? other.then((r2) => combine(r1, r2)) : combine(r1, other)
			);
		}
		return other instanceof Promise
			? other.then((r2) => combine(input, r2))
			: combine(input, other);
	};
}

export function or<T, E>(
	input: Result<T, E>,
): <Alternative>(
	alternative: () => Alternative,
) => IsAsync<Alternative> extends true
	? AsyncResult<T | UnwrappedVal<Alternative>, UnwrappedErr<Alternative>>
	: Result<T | UnwrappedVal<Alternative>, UnwrappedErr<Alternative>>;
export function or<T, E>(
	input: AsyncResult<T, E>,
): <Alternative>(
	alternative: () => Alternative,
) => AsyncResult<T | UnwrappedVal<Alternative>, UnwrappedErr<Alternative>>;
export function or(input: any) {
	return function (alternative: any): any {
		if (input instanceof Promise) {
			return input.then((r) => (r.ok ? r : alternative()));
		}
		return input.ok ? input : alternative();
	};
}

export function tap<T, E>(
	input: Result<T, E>,
): (fn: (value: T) => unknown) => Result<T, E>;
export function tap<T, E>(
	input: AsyncResult<T, E>,
): (fn: (value: T) => unknown) => AsyncResult<T, E>;
export function tap(input: any) {
	return function (fn: any): any {
		if (input instanceof Promise) {
			return input.then(async (r) => {
				if (r.ok) await fn(r.value);
				return r;
			});
		}
		if (input.ok) fn(input.value);
		return input;
	};
}

export function tapError<T, E>(
	input: Result<T, E>,
): (fn: (error: E) => unknown) => Result<T, E>;
export function tapError<T, E>(
	input: AsyncResult<T, E>,
): (fn: (error: E) => unknown) => AsyncResult<T, E>;
export function tapError(input: any) {
	return function (fn: any): any {
		if (input instanceof Promise) {
			return input.then(async (r) => {
				if (!r.ok) await fn(r.error);
				return r;
			});
		}
		if (!input.ok) fn(input.error);
		return input;
	};
}

export function filter<T, E>(
	input: Result<T, E>,
): <F>(predicate: (value: T) => boolean, error: F) => Result<T, E | F>;
export function filter<T, E>(
	input: AsyncResult<T, E>,
): <F>(predicate: (value: T) => boolean, error: F) => AsyncResult<T, E | F>;
export function filter(input: any) {
	return function (predicate: any, error: any): any {
		const applyFilter = (r: Result<any, any>) => (r.ok ? (predicate(r.value) ? r : err(error)) : r);
		return input instanceof Promise ? input.then(applyFilter) : applyFilter(input);
	};
}

export function forEach<T, E>(
	input: Result<T, E>,
): (fn: (value: T) => unknown) => void;
export function forEach<T, E>(
	input: AsyncResult<T, E>,
): (fn: (value: T) => unknown) => Promise<void>;
export function forEach(input: any) {
	return function (fn: any): any {
		if (input instanceof Promise) {
			return input.then(async (r) => {
				if (r.ok) await fn(r.value);
			});
		}
		if (input.ok) {
			fn(input.value);
		}
	};
}

export function unwrap<T, E>(input: Result<T, E>): T;
export function unwrap<T, E>(input: AsyncResult<T, E>): Promise<T>;
export function unwrap(input: any): any {
	if (input instanceof Promise) {
		return input.then((r) => {
			if (!r.ok) throw r.error;
			return r.value;
		});
	}
	if (!input.ok) throw input.error;
	return input.value;
}

export function unwrapOr<T, E>(input: Result<T, E>): (defaultValue: T) => T;
export function unwrapOr<T, E>(input: AsyncResult<T, E>): (defaultValue: T) => Promise<T>;
export function unwrapOr(input: any) {
	return function (defaultValue: any): any {
		if (input instanceof Promise) {
			return input.then((r) => (r.ok ? r.value : defaultValue));
		}
		return input.ok ? input.value : defaultValue;
	};
}

export function safe<Target extends (() => Promise<any>) | Promise<any>, E = NetworkError>(
	target: Target,
	mapError: (e: unknown) => E = (e) =>
		Errors.network(e instanceof Error ? e.message : String(e)) as E,
): Promise<
	Result<
		Target extends (() => Promise<infer T>) ? T : (Target extends Promise<infer T> ? T : unknown),
		E
	>
> {
	const execute = async () => {
		try {
			const value = typeof target === "function" ? await target() : await target;
			return ok(value);
		} catch (e) {
			return err(mapError(e));
		}
	};
	return execute() as any;
}

export type ZippedValues<T extends readonly (Result<any, any> | AsyncResult<any, any>)[]> = {
	[K in keyof T]: UnwrappedVal<T[K]>;
};

export type ZippedErrors<T extends readonly (Result<any, any> | AsyncResult<any, any>)[]> =
	UnwrappedErr<T[number]>;

export function zip<T extends readonly (Result<any, any> | AsyncResult<any, any>)[]>(
	...results: T
): true extends IsAsync<T[number]> ? AsyncResult<ZippedValues<T>, ZippedErrors<T>>
	: Result<ZippedValues<T>, ZippedErrors<T>> {
	const hasPromise = results.some((r) => r instanceof Promise);

	if (!hasPromise) {
		const values: any[] = [];
		for (const r of results as readonly Result<any, any>[]) {
			if (!r.ok) return err(r.error) as any;
			values.push(r.value);
		}
		return ok(values) as any;
	}

	return Promise.all(results).then((resolved) => {
		const values: any[] = [];
		for (const r of resolved) {
			if (!r.ok) return err(r.error);
			values.push(r.value);
		}
		return ok(values);
	}) as any;
}
