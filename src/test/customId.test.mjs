import assert from "node:assert/strict";
import test from "node:test";

import {
  CUSTOM_ID_MAX_LENGTH,
  CustomIdBuilder,
  CustomIdError,
} from "../../dist/index.js";

test("customId: build joins name:entityId:executorId with ':'", () => {
  assert.equal(
    CustomIdBuilder.build({ name: "_modal", entityId: "x7k", executorId: "555" }),
    "_modal:x7k:555",
  );
});

test("customId: 'not'/empty/undefined segments are skipped", () => {
  assert.equal(CustomIdBuilder.build({ name: "_button" }), "_button");
  assert.equal(CustomIdBuilder.build({ name: "_button", entityId: "not" }), "_button");
  assert.equal(CustomIdBuilder.build({ name: "_button", executorId: "" }), "_button");
  assert.equal(
    CustomIdBuilder.build({ name: "_button", entityId: "not", executorId: "7" }),
    "_button:7",
  );
});

test("customId: extra rest segments are appended in order", () => {
  assert.equal(
    CustomIdBuilder.build({ name: "_sel", entityId: "e", rest: ["2", "p"] }),
    "_sel:e:2:p",
  );
});

test("customId: build throws when the id exceeds 100 chars", () => {
  const long = "я".repeat(90);
  let error;
  try {
    CustomIdBuilder.build({ name: "_modal", entityId: long, executorId: "abc" });
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof CustomIdError);
  assert.match(error.message, /max 100 chars, got 101/);
  assert.match(error.message, /shrink by 1/);
});

test("customId: build throws when name is empty or a part contains ':'", () => {
  assert.throws(() => CustomIdBuilder.build({ name: "" }), /name is required/);
  assert.throws(
    () => CustomIdBuilder.build({ name: "_modal", entityId: "a:b" }),
    /contains ":"/,
  );
});

test("customId: parse returns typed, human-friendly parts", () => {
  const parsed = CustomIdBuilder.parse("_modal:x7k:555");
  assert.deepEqual(parsed, {
    name: "_modal",
    entityId: "x7k",
    executorId: "555",
    rest: [],
    raw: "_modal:x7k:555",
    length: 14,
  });
  assert.equal(parsed.name, "_modal");
});

test("customId: parse splits leniently and never throws", () => {
  const parsed = CustomIdBuilder.parse("pick:2");
  assert.equal(parsed.name, "pick");
  assert.equal(parsed.entityId, "2");
  assert.equal(parsed.executorId, undefined);
  assert.deepEqual(parsed.rest, []);
  assert.equal(CustomIdBuilder.parse("").name, "");
});

test("customId: is/isValid route handlers", () => {
  const id = CustomIdBuilder.build({ name: "_button", entityId: "x" });
  assert.equal(CustomIdBuilder.is(id, "_button"), true);
  assert.equal(CustomIdBuilder.is(id, "_modal"), false);
  assert.equal(CustomIdBuilder.is("_modal:x", "_modal"), true);
  assert.equal(CustomIdBuilder.is("", "_modal"), false);
  assert.equal(CustomIdBuilder.is(":x", "_modal"), false);
  assert.equal(CustomIdBuilder.isValid("a".repeat(100)), true);
  assert.equal(CustomIdBuilder.isValid("a".repeat(101)), false);
});

test("customId: capacityOf/remaining report the budget", () => {
  const data = { name: "_modal", entityId: "x", executorId: "y" };
  const id = CustomIdBuilder.build(data);
  assert.equal(CustomIdBuilder.capacityOf(data), id.length);
  assert.equal(CustomIdBuilder.remaining(data), CUSTOM_ID_MAX_LENGTH - id.length);
});