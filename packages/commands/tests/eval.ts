/**
 * kuristina, a ~~kitchen~~ bathroom sink discord bot
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { sandboxFlags } from "@kuristina/core";
import { stripCodeFence, wrapSource } from "../src/dev/eval-source.ts";

Deno.test("stripCodeFence unwraps fenced snippets", () => {
	assertEquals(stripCodeFence("```ts\nconst a = 1\n```"), "const a = 1");
	assertEquals(stripCodeFence("```\n1 + 1\n```"), "1 + 1");
	assertEquals(stripCodeFence("  1 + 1  "), "1 + 1");
	assertEquals(stripCodeFence("`inline`"), "`inline`");
});

Deno.test("wrapSource returns bare expressions", () => {
	assertStringIncludes(wrapSource("1 + 1"), "return (1 + 1);");
	assertStringIncludes(wrapSource("1 + 1;"), "return (1 + 1);");
	assertStringIncludes(wrapSource("await foo()"), "return (await foo());");
});

Deno.test("wrapSource keeps statements as statements", () => {
	assertStringIncludes(wrapSource("const a = 1;\nreturn a;"), "const a = 1;");
	assertStringIncludes(wrapSource("throw new Error('x')"), "throw new Error('x')");
	assertStringIncludes(wrapSource("if (true) return 1;"), "if (true) return 1;");
});

Deno.test("the default sandbox grants no permissions", () => {
	assertEquals(sandboxFlags({}), ["--no-prompt"]);
	assertEquals(sandboxFlags({ net: true, import: true }), [
		"--no-prompt",
		"--allow-net",
		"--allow-import",
	]);
	assertEquals(sandboxFlags({ read: ["/tmp"] }), ["--no-prompt", "--allow-read=/tmp"]);
	assertEquals(sandboxFlags({ read: [] }), ["--no-prompt"]);
});
