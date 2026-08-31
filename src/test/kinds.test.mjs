import assert from "node:assert/strict";
import test from "node:test";
import {
  ComponentType,
  V2Builder,
  getAllByKind,
  getByKind,
  isComponentKind,
  kindOfType,
  removeByKind,
  replaceByKind,
} from "../../dist/index.js";
import { moveByKind } from "../../dist/advanced.js";

const TEXT = ComponentType.TextDisplay;
const SEP = ComponentType.Separator;
const ROW = ComponentType.ActionRow;

function containerOf(builder) {
  return builder.toJSON();
}

test("kinds: isComponentKind validates kind names", () => {
  for (const kind of ["textDisplay", "section", "separator", "actionRow", "mediaGallery"]) {
    assert.equal(isComponentKind(kind), true);
  }
  for (const bad of ["container", "button", 1, "", null, undefined]) {
    assert.equal(isComponentKind(bad), false);
  }
});

test("kinds: kindOfType maps component types", () => {
  assert.equal(kindOfType(ComponentType.TextDisplay), "textDisplay");
  assert.equal(kindOfType(ComponentType.Section), "section");
  assert.equal(kindOfType(ComponentType.Separator), "separator");
  assert.equal(kindOfType(ComponentType.ActionRow), "actionRow");
  assert.equal(kindOfType(ComponentType.MediaGallery), "mediaGallery");
  assert.equal(kindOfType(ComponentType.Button), null);
  assert.equal(kindOfType(ComponentType.Container), null);
});

test("kinds: standalone functions absorb a container root", () => {
  const builder = new V2Builder().text("a").separator().text("b");
  const roots = [containerOf(builder)];
  assert.equal(getAllByKind(roots, "textDisplay").length, 2);
  assert.equal(getByKind(roots, "separator", 0).index, 0);

  assert.equal(removeByKind(roots, "textDisplay", 1), true);
  assert.equal(getAllByKind(roots, "textDisplay").length, 1);
  assert.equal(getByKind(roots, "textDisplay", 0).component.content, "a");

  assert.equal(replaceByKind(roots, "textDisplay", 0, { type: TEXT, content: "z" }), true);
  assert.equal(getByKind(roots, "textDisplay", 0).component.content, "z");

  // separator moved to the end of its kind (still one, so effectively last)
  assert.equal(moveByKind(roots, "separator", 0, 0), true);
});

test("kinds: out-of-bounds are safe falses", () => {
  const roots = [new V2Builder().text("only").toJSON()];
  assert.equal(getByKind(roots, "section", 0), null);
  assert.equal(removeByKind(roots, "section", 3), false);
  assert.equal(replaceByKind(roots, "section", 3, { type: ComponentType.Section }), false);
  assert.equal(moveByKind(roots, "section", 3, 0), false);
});

test("kinds: indices are per-kind, not per container slot", () => {
  const builder = new V2Builder()
    .text("t0")
    .separator()
    .text("t1")
    .separator()
    .text("t2");
  const all = getAllByKind([builder.toJSON()], "textDisplay");
  assert.deepEqual(
    all.map((r) => r.containerIndex),
    [0, 2, 4],
  );
  assert.deepEqual(
    all.map((r) => r.index),
    [0, 1, 2],
  );
});

test("kinds: removeByKind splices the exact container child", () => {
  const builder = new V2Builder().text("a").separator().text("b").build();
  const roots = builder.components;
  removeByKind(roots, "textDisplay", 1); // drop "b"; the separator stays in place
  const seps = getAllByKind(roots, "separator");
  assert.equal(seps.length, 1);
  assert.deepEqual(flatten(roots).map((c) => c.type), [ComponentType.Container, TEXT, SEP]);
});

function flatten(list) {
  const out = [];
  for (const c of list) {
    out.push(c);
    if (Array.isArray(c.components)) out.push(...flatten(c.components));
    if (c.accessory) out.push(c.accessory);
  }
  return out;
}