import assert from "node:assert/strict";
import test from "node:test";
import { ComponentType, V2Builder } from "../../dist/index.js";
import { V2Template } from "../../dist/template.js";

const TEXT = ComponentType.TextDisplay;

function textOf(payload, at = 0) {
  return payload.components[0].components[at].content;
}

test("template: auto sentinel from slot key", () => {
  const tpl = new V2Template(new V2Builder().text("Привет, {{name}}!"));
  tpl.slot("name");
  assert.equal(tpl.sentinelOf("name"), "{{name}}");
  assert.deepEqual(tpl.slotKeys(), ["name"]);

  const payload = tpl.render({ name: "Мир" }).build();
  assert.equal(textOf(payload), "Привет, Мир!");
});

test("template: explicit sentinel and multiple slots", () => {
  const tpl = new V2Template(new V2Builder().text("__C1__/__C2__")).slot(
    "first",
    "__C1__",
  );
  tpl.slots({ second: "__C2__" });
  assert.equal(
    textOf(tpl.render({ first: "A", second: "B" }).build()),
    "A/B",
  );
});

test("template: render never mutates the skeleton", () => {
  const tpl = new V2Template(new V2Builder().text("{{x}}"));
  tpl.slot("x");
  tpl.render({ x: "один" });
  const untouched = tpl.render({ x: "два" });
  assert.equal(textOf(untouched.build()), "два");
  // the base skeleton still holds the sentinel
  assert.equal(textOf(tpl.build()), "{{x}}");
});

test("template: undefined values leave the sentinel untouched", () => {
  const tpl = new V2Template(new V2Builder().text("{{x}}"));
  tpl.slot("x");
  const payload = tpl.render({ x: undefined }).build();
  assert.equal(textOf(payload), "{{x}}");
});

test("template: plain message content is substituted too", () => {
  const tpl = new V2Template(
    new V2Builder().content("Показываю: {{n}}").text("Блок"),
  ).slot("n");
  const payload = tpl.render({ n: 42 }).build();
  assert.equal(payload.content, "Показываю: 42");
  assert.equal(textOf(payload), "Блок");
});

test("template: parse accepts message-like / raw components", () => {
  const tpl = V2Template.parse([{ type: TEXT, content: "{{v}}" }]);
  tpl.slot("v");
  assert.equal(textOf(tpl.render({ v: "ok" }).build()), "ok");
});

test("template: numbers render as strings", () => {
  const tpl = new V2Template(new V2Builder().text("Число: {{n}}"));
  tpl.slot("n");
  assert.equal(textOf(tpl.render({ n: 7 }).build()), "Число: 7");
});

test("template: builder exposes the underlying skeleton", () => {
  const base = new V2Builder().text("x");
  const tpl = new V2Template(base);
  assert.equal(tpl.builder, base);
  assert.equal(tpl.build().flags, 32768);
});