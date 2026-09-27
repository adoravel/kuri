/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { IsAsync, UnwrappedErr, UnwrappedVal } from "./helpers.ts";
import { unwrap, unwrapOr, zip, type ZippedErrors, type ZippedValues } from "./ops.ts";
import { type AsyncResult, err, ok, type Result } from "./result.ts";

type PipelineValue<Input, T, E> = Input extends Promise<any> ? AsyncResult<T, E> : Result<T, E>;

type Pipeline<Input, T, E> = {
	then: Input extends Promise<any> ? <TResult1 = Result<T, E>, TResult2 = never>(
			onfulfilled?: ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>) | null,
			onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
		) => Promise<TResult1 | TResult2>
		: never;

	flatMap<Ret>(
		fn: (value: T) => Ret,
	): Pipeline<
		Input extends Promise<any> ? AsyncResult<UnwrappedVal<Ret>, E | UnwrappedErr<Ret>>
			: (IsAsync<Ret> extends true ? AsyncResult<UnwrappedVal<Ret>, E | UnwrappedErr<Ret>>
				: Result<UnwrappedVal<Ret>, E | UnwrappedErr<Ret>>),
		UnwrappedVal<Ret>,
		E | UnwrappedErr<Ret>
	>;

	map<U>(
		fn: (value: T) => U,
	): Pipeline<
		Input extends Promise<any> ? AsyncResult<Awaited<U>, E>
			: (U extends Promise<any> ? AsyncResult<Awaited<U>, E>
				: Result<U, E>),
		Awaited<U>,
		E
	>;

	flatMapError<Ret>(
		fn: (error: E) => Ret,
	): Pipeline<
		Input extends Promise<any> ? AsyncResult<T | UnwrappedVal<Ret>, UnwrappedErr<Ret>>
			: (IsAsync<Ret> extends true ? AsyncResult<T | UnwrappedVal<Ret>, UnwrappedErr<Ret>>
				: Result<T | UnwrappedVal<Ret>, UnwrappedErr<Ret>>),
		T | UnwrappedVal<Ret>,
		UnwrappedErr<Ret>
	>;

	filter<F>(predicate: (value: T) => boolean, error: F): Pipeline<Input, T, E | F>;

	and<Other>(
		other: Other,
	): Pipeline<
		Input extends Promise<any> ? AsyncResult<T & UnwrappedVal<Other>, E | UnwrappedErr<Other>>
			: (IsAsync<Other> extends true ? AsyncResult<T & UnwrappedVal<Other>, E | UnwrappedErr<Other>>
				: Result<T & UnwrappedVal<Other>, E | UnwrappedErr<Other>>),
		T & UnwrappedVal<Other>,
		E | UnwrappedErr<Other>
	>;

	or<Other>(
		alternative: () => Other,
	): Pipeline<
		Input extends Promise<any> ? AsyncResult<T | UnwrappedVal<Other>, UnwrappedErr<Other>>
			: (IsAsync<Other> extends true ? AsyncResult<T | UnwrappedVal<Other>, UnwrappedErr<Other>>
				: Result<T | UnwrappedVal<Other>, UnwrappedErr<Other>>),
		T | UnwrappedVal<Other>,
		UnwrappedErr<Other>
	>;

	tap<Ret>(
		fn: (value: T) => Ret,
	): Pipeline<
		Input extends Promise<any> ? AsyncResult<T, E>
			: (Ret extends Promise<any> ? AsyncResult<T, E> : Result<T, E>),
		T,
		E
	>;

	tapError<Ret>(
		fn: (error: E) => Ret,
	): Pipeline<
		Input extends Promise<any> ? AsyncResult<T, E>
			: (Ret extends Promise<any> ? AsyncResult<T, E> : Result<T, E>),
		T,
		E
	>;

	zip<Others extends readonly (Result<any, any> | AsyncResult<any, any>)[]>(
		...others: Others
	): Pipeline<
		Input extends Promise<any> ? AsyncResult<[T, ...ZippedValues<Others>], E | ZippedErrors<Others>>
			: (true extends IsAsync<Others[number]>
				? AsyncResult<[T, ...ZippedValues<Others>], E | ZippedErrors<Others>>
				: Result<[T, ...ZippedValues<Others>], E | ZippedErrors<Others>>),
		[T, ...ZippedValues<Others>],
		E | ZippedErrors<Others>
	>;

	unwrap(): Input extends Promise<any> ? Promise<T> : T;
	unwrapOr(defaultValue: T): Input extends Promise<any> ? Promise<T> : T;
	value: PipelineValue<Input, T, E>;
};

function unwrapRaw(obj: any): any {
	if (obj && typeof obj === "object") {
		if ("unwrap" in obj && "value" in obj) {
			return obj.value;
		}
	}
	return obj;
}

export function pipe<T, E>(input: Result<T, E>): Pipeline<Result<T, E>, T, E>;
export function pipe<T, E>(input: AsyncResult<T, E>): Pipeline<AsyncResult<T, E>, T, E>;
export function pipe<T, E>(input: Result<T, E> | AsyncResult<T, E>): any {
	const target = input as any;

	const instance = {
		map: (fn: any) => {
			if (target instanceof Promise) {
				return pipe(target.then((r) => r.ok ? ok(fn(r.value)) : err(r.error)) as any);
			}
			if (!target.ok) return pipe(err(target.error));

			const res = fn(target.value);
			if (res instanceof Promise) {
				return pipe(res.then((val) => ok(val)) as any);
			}
			return pipe(ok(res));
		},
		flatMap: (fn: any) => {
			if (target instanceof Promise) {
				return pipe(target.then((r) => {
					if (!r.ok) return err(r.error);
					return unwrapRaw(fn(r.value));
				}) as any);
			}
			if (!target.ok) return pipe(err(target.error));
			return pipe(unwrapRaw(fn(target.value)));
		},
		flatMapError: (fn: any) => {
			if (target instanceof Promise) {
				return pipe(target.then((r) => {
					if (r.ok) return ok(r.value);
					return unwrapRaw(fn(r.error));
				}) as any);
			}
			if (target.ok) return pipe(ok(target.value));
			return pipe(unwrapRaw(fn(target.error)));
		},
		filter: (predicate: any, error: any) => {
			const applyFilter = (r: Result<any, any>) => r.ok ? (predicate(r.value) ? r : err(error)) : r;
			return pipe(
				(target instanceof Promise ? target.then(applyFilter) : applyFilter(target)) as any,
			);
		},
		and: (other: any) => {
			const otherRaw = unwrapRaw(other);
			const combine = (r1: Result<any, any>, r2: Result<any, any>) => {
				if (!r1.ok) return err(r1.error);
				if (!r2.ok) return err(r2.error);
				const combined = typeof r1.value === "object" && r1.value !== null
					? { ...r1.value, ...r2.value }
					: r2.value;
				return ok(combined);
			};
			if (target instanceof Promise) {
				return pipe(
					target.then((r1) =>
						otherRaw instanceof Promise
							? otherRaw.then((r2) => combine(r1, r2))
							: combine(r1, otherRaw)
					) as any,
				);
			}
			return pipe(
				(otherRaw instanceof Promise
					? otherRaw.then((r2) => combine(target, r2))
					: combine(target, otherRaw)) as any,
			);
		},
		or: (alternative: any) => {
			if (target instanceof Promise) {
				return pipe(target.then((r) => r.ok ? r : unwrapRaw(alternative())) as any);
			}
			return pipe(target.ok ? target : unwrapRaw(alternative()));
		},
		tap: (fn: any) => {
			if (target instanceof Promise) {
				return pipe(target.then(async (r) => {
					if (r.ok) await fn(r.value);
					return r;
				}) as any);
			}
			if (target.ok) {
				const res = fn(target.value);
				if (res instanceof Promise) {
					return pipe(res.then(() => target) as any);
				}
			}
			return pipe(target);
		},
		tapError: (fn: any) => {
			if (target instanceof Promise) {
				return pipe(target.then(async (r) => {
					if (!r.ok) await fn(r.error);
					return r;
				}) as any);
			}
			if (!target.ok) {
				const res = fn(target.error);
				if (res instanceof Promise) {
					return pipe(res.then(() => target) as any);
				}
			}
			return pipe(target);
		},
		zip: (...others: any[]) => {
			const current = target;
			const all = [current, ...others.map(unwrapRaw)];

			return pipe(zip(...(all as any)));
		},
		unwrap: () => unwrap(target),
		unwrapOr: (defaultValue: any) => unwrapOr(target)(defaultValue),
		get value() {
			return input;
		},
	};

	if (target instanceof Promise) {
		Object.defineProperty(instance, "then", {
			value: (onfulfilled: any, onrejected: any) => target.then(onfulfilled, onrejected),
			configurable: true,
			enumerable: true,
		});
	}

	return instance;
}
