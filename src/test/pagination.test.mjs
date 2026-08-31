import assert from "node:assert/strict";
import test from "node:test";
import { V2Builder } from "../../dist/index.js";
import { V2Template } from "../../dist/template.js";
import { V2Paginator } from "../../dist/pagination.js";

const BUTTON = 2;
const ROW = 1;
const CONTAINER = 0;

function pageButtons(payload) {
  const container = payload.components[0];
  const row = container.components.find((c) => c.type === ROW);
  return row ? row.components.filter((c) => c.type === BUTTON) : [];
}

test("paginator: renders page content plus pagination row", () => {
  const tpl = new V2Template(new V2Builder().text("{{body}}"));
  tpl.slot("body");
  const pages = new V2Paginator({
    template: tpl,
    pages: [{ body: "Страница 1" }, { body: "Страница 2" }, { body: "Страница 3" }],
    pageButton: "pag",
  });

  const payload = pages.render(1);
  assert.equal(payload.components[0].components[0].content, "Страница 2");

  const buttons = pageButtons(payload);
  assert.equal(buttons.length, 3);
  assert.deepEqual(
    buttons.map((b) => b.custom_id),
    ["pag:0", "pag:1", "pag:2"],
  );
  assert.equal(buttons[1].disabled, true);
  assert.equal(buttons[0].disabled, false);
  assert.equal(buttons[1].style, 1); // Primary highlights current
  assert.equal(buttons[0].style, 2); // Secondary for the rest
});

test("paginator: labels can be customized", () => {
  const pages = new V2Paginator({
    template: new V2Template(new V2Builder().text("x")),
    pages: [{}, {}],
    pageButton: "p",
    pageLabel: (i, total) => `${i + 1}/${total}`,
  });
  assert.deepEqual(
    pageButtons(pages.render(0)).map((b) => b.label),
    ["1/2", "2/2"],
  );
});

test("paginator: template-per-page works without a shared template", () => {
  const pages = new V2Paginator({
    pages: [
      new V2Template(new V2Builder().text("Один")),
      new V2Template(new V2Builder().text("Два")),
    ],
    pageButton: "pg",
  });
  assert.equal(pages.render(0).components[0].components[0].content, "Один");
  assert.equal(pages.render(1).components[0].components[0].content, "Два");
});

test("paginator: out-of-range page throws", () => {
  const pages = new V2Paginator({
    pages: [new V2Template(new V2Builder().text("x"))],
    pageButton: "p",
  });
  assert.throws(() => pages.render(1), /out of range/);
  assert.throws(() => pages.render(-1), /out of range/);
});

test("paginator: too many pages throw", () => {
  const oneSlide = new V2Template(new V2Builder().text("x"));
  assert.throws(
    () =>
      new V2Paginator({
        pages: Array.from({ length: 6 }, () => oneSlide),
        pageButton: "p",
      }),
    /at most 5 pages/,
  );
});

test("paginator: currentFromMessage finds the disabled page button", () => {
  const pages = new V2Paginator({
    template: new V2Template(new V2Builder().text("{{m}}")).slot("m"),
    pages: [{ m: "1" }, { m: "2" }, { m: "3" }],
    pageButton: "pag",
  });
  const payload = pages.render(1);
  assert.equal(pages.currentFromMessage({ components: payload.components }), 1);
});

test("paginator: jump via update() for numbered buttons", async () => {
  const pages = new V2Paginator({
    template: new V2Template(new V2Builder().text("{{m}}")).slot("m"),
    pages: [{ m: "1" }, { m: "2" }],
    pageButton: "pag",
  });

  const calls = [];
  const interaction = {
    customId: "pag:1",
    message: null,
    update: async (p) => calls.push(p),
  };
  assert.equal(await pages.jump(interaction), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].components[0].components[0].content, "2");
});

test("paginator: jump through ctx.interaction (discordx shape)", async () => {
  const pages = new V2Paginator({
    template: new V2Template(new V2Builder().text("{{m}}")).slot("m"),
    pages: [{ m: "1" }, { m: "2" }, { m: "3" }],
    pageButton: "pag",
  });

  // current page read from the message's disabled button
  const currentMessage = { components: pages.render(2).components };
  const interaction = {
    customId: "pag:prev",
    message: currentMessage,
    editReply: async (p) => asserted.push(p),
  };
  const asserted = [];
  assert.equal(await pages.jump({ interaction }), true);
  assert.equal(asserted.length, 1);
  assert.equal(asserted[0].components[0].components[0].content, "2");
});

test("paginator: jump ignores foreign custom_ids", async () => {
  const pages = new V2Paginator({
    pages: [new V2Template(new V2Builder().text("x"))],
    pageButton: "pag",
  });
  assert.equal(await pages.jump({ customId: "other:1" }), false);
  assert.equal(await pages.jump({}), false);
});

test("paginator: same page / out-of-bounds target are ignored", async () => {
  const pages = new V2Paginator({
    pages: [new V2Template(new V2Builder().text("x")), new V2Template(new V2Builder().text("y"))],
    pageButton: "pag",
  });
  const interaction = {
    customId: "pag:0",
    message: null,
    update: async () => {
      throw new Error("must not be called");
    },
  };
  assert.equal(await pages.jump(interaction), false); // clicking current page
  const oob = { ...interaction, customId: "pag:9" };
  assert.equal(await pages.jump(oob), false);
});

test("paginator: next button replies via reply() as a fallback", async () => {
  const pages = new V2Paginator({
    pages: [new V2Template(new V2Builder().text("a")), new V2Template(new V2Builder().text("b"))],
    pageButton: "pag",
  });
  const interaction = {
    customId: "pag:next",
    message: { components: pages.render(0).components },
    reply: async (p) => {
      calls.push(p);
    },
  };
  const calls = [];
  assert.equal(await pages.jump(interaction), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].components[0].components[0].content, "b");
});