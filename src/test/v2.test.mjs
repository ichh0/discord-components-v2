import test from "node:test";
import assert from "node:assert/strict";
import {
  V2Builder,
  editComponents,
  parseComponents,
  parseEmoji,
  ComponentType,
  findComponents,
  validateComponents,
  getSections,
  getSection,
  removeSection,
  replaceSection,
  moveSection,
} from "../../dist/index.js";

const CONTAINER = ComponentType.Container;
const TEXT = ComponentType.TextDisplay;
const ROW = ComponentType.ActionRow;
const BUTTON = ComponentType.Button;

function makeBuilt() {
  return new V2Builder()
    .text("# Розыгрыш")
    .field("Приз", "100 монет")
    .buttons(
      { id: "join", label: "Участвовать", style: "Success" },
      { id: "close", label: "Закрыть", style: "Danger" },
      { url: "https://example.com", label: "Сайт" },
    )
    .selectMenu.string({
      customId: "pick",
      placeholder: "Выбери",
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
    })
    .color(0xffaa00)
    .build();
}

test("build: payload structure and flags", () => {
  const payload = makeBuilt();
  assert.equal(payload.flags, 32768);
  assert.equal(payload.components.length, 1);
  const container = payload.components[0];
  assert.equal(container.type, CONTAINER);
  assert.equal(container.accent_color, 0xffaa00);

  const children = container.components;
  // text + field + row(buttons) + row(select)
  assert.equal(children.filter((c) => c.type === TEXT).length, 2);
  const rows = children.filter((c) => c.type === ROW);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].components.length, 3);
  assert.equal(rows[1].components[0].type, ComponentType.StringSelect);
});

test("build: validation rejects empty action row", () => {
  const b = parseComponents([{ type: 1, components: [] }]);
  assert.throws(() => b.build(), /at least one/);
});

test("build: button without id/url throws", () => {
  assert.throws(() => new V2Builder().buttons({ label: "x" }).build(), /'id', 'url' or 'skuId'/);
});

test("fields: aligned ansi block", () => {
  const b = new V2Builder().fields([
    { name: "Организатор", value: "<@123>" },
    { name: "Приз", value: "100" },
  ]);
  const text = b.getTexts()[0];
  assert.match(text, /```ansi/);
  assert.match(text, /Организатор\s+Приз/);
});

test("section with thumbnail and with button", () => {
  const payload = new V2Builder()
    .section({ title: "Привет", thumbnailUrl: "https://x/y.png" })
    .section({ title: "Кнопка", button: { id: "acc", label: "Жми" } })
    .build();
  const sections = payload.components[0].components.filter((c) => c.type === ComponentType.Section);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].accessory.type, ComponentType.Thumbnail);
  assert.equal(sections[1].accessory.custom_id, "acc");
});

test("media registers attachment file", () => {
  const b = new V2Builder().media(Buffer.from([1]), "pic.png");
  const payload = b.build();
  assert.equal(payload.files[0].name, "pic.png");
  const gallery = payload.components[0].components.find((c) => c.type === ComponentType.MediaGallery);
  assert.equal(gallery.items[0].media.url, "attachment://pic.png");
});

test("parse: round trip keeps everything (no cache needed)", () => {
  const original = makeBuilt();
  const rebuilt = parseComponents(original).build();

  assert.deepEqual(rebuilt.components, original.components);
  assert.deepEqual(rebuilt.flags, original.flags);
});

test("parse: accepts message-like objects and toJSON duck-typing", () => {
  const messageLike = { components: makeBuilt().components, content: "plain content", id: "m1" };
  const parsed = parseComponents(messageLike);
  assert.equal(parsed.build().content, "plain content");

  const fakeDjsInstance = { toJSON: () => makeBuilt().components };
  assert.equal(parseComponents(fakeDjsInstance).build().components.length, 1);
});

test("parse: every ergonomic entry path yields a clean container (no indexed junk)", () => {
  const children = [
    { type: TEXT, id: 2, content: "123123" },
    { type: ROW, id: 3, components: [{ type: BUTTON, style: 2, label: "213", id: 4, custom_id: "a_" }] },
    { type: ROW, id: 5, components: [{ type: BUTTON, style: 2, label: "213", id: 6, custom_id: "a__" }] },
    { type: ROW, id: 7, components: [{ type: BUTTON, style: 2, label: "213", id: 8, custom_id: "a___" }] },
  ];
  const container = { type: CONTAINER, id: 1, accent_color: null, spoiler: false, components: children };

  const paths = [
    ["children array", children],
    ["outer [container]", [container]],
    ["single container", container],
    ["message-like wrapper", { components: [container] }],
    ["constructor(children)", new V2Builder(children)],
  ];

  for (const [name, input] of paths) {
    const json = parseComponents(input).build();
    assert.equal(json.flags, 32768, name);
    assert.equal(json.components.length, 1, name);
    const root = json.components[0];
    assert.equal(root.type, CONTAINER, name);
    // no numeric-key garbage like {"0": {...}} next to an empty components
    for (const key of Object.keys(root)) {
      assert.match(key, /^(type|id|accent_color|spoiler|components)$/, `${name}: junk key "${key}"`);
    }
    assert.ok(Array.isArray(root.components), name);
    assert.equal(root.components.length, 4, name);
    if (name !== "children array" && name !== "constructor(children)") {
      assert.equal(root.id, 1, name); // metadata survives absorption
    }
  }
});

/** Shape of `ctx.fetchReply()` / `interaction.fetchReply()` for a CV2 message. */
function makeFetchedReply() {
  return {
    channelId: "1540382355527835698",
    guildId: "1540382070981791826",
    id: "1540672776430690434",
    createdTimestamp: 1787395414217,
    type: 20, // message type — NOT a valid component type
    system: false,
    content: "",
    authorId: "1525082523330150512",
    pinned: false,
    tts: false,
    embeds: [],
    flags: 32768, // IS_COMPONENTS_V2
    attachments: [],
    stickers: [],
    components: [
      {
        type: CONTAINER,
        id: 1,
        accent_color: null,
        spoiler: false,
        components: [
          { type: TEXT, id: 2, content: "Hello world" },
          {
            type: ComponentType.Section,
            id: 3,
            accessory: { type: BUTTON, id: 5, custom_id: "test2", style: 2, label: "test", disabled: true },
            components: [{ type: TEXT, id: 4, content: "**hello**" }],
          },
          {
            type: ROW,
            id: 6,
            components: [
              { type: BUTTON, id: 7, custom_id: "fff", style: 2, label: "dsbButtons", disabled: true },
            ],
          },
          {
            type: ROW,
            id: 8,
            components: [
              {
                type: ComponentType.StringSelect,
                id: 9,
                custom_id: "test",
                placeholder: "choice",
                min_values: 1,
                max_values: 1,
                options: [{ label: "123", value: "fdsfsdf" }],
              },
            ],
          },
          { type: TEXT, id: 10, content: "-# 123123" },
        ],
      },
    ],
  };
}

test("parse: unwraps full fetched Message objects (regression: type must not be 20)", () => {
  const fetched = makeFetchedReply();

  // bare message
  let edited = editComponents(fetched).enableButtons().toJSON();
  assert.equal(edited.length, 1);
  assert.equal(edited[0].type, CONTAINER); // container root, NOT the whole message
  assert.ok(flatten(edited).every((c) => c.type !== 20));
  assert.equal(flatten(edited).find((c) => c.custom_id === "fff").disabled, false);

  // message wrapped in an array (discordx ctx.fetchReply() shape)
  edited = editComponents([fetched]).enableButtons().toJSON();
  assert.equal(edited.length, 1);
  assert.equal(edited[0].type, CONTAINER);

  // snake_case raw API shape is unwrapped the same way
  edited = editComponents([{ ...fetched }]).disableButtons().toJSON();
  assert.equal(edited[0].type, CONTAINER);

  // parseComponents works too and keeps plain content
  const parsed = parseComponents({ ...fetched, content: "hello content" });
  assert.equal(parsed.build().content, "hello content");
  assert.equal(parsed.build().components[0].type, CONTAINER);

  // toJSON duck-typing of a real djs Message instance
  const djsLike = { toJSON: () => ({ ...fetched }) };
  assert.equal(editComponents(djsLike).length, 1);
});

test("parse: message without components yields empty payload", () => {
  const fetched = makeFetchedReply();
  delete fetched.components;
  assert.deepEqual(editComponents(fetched).toJSON(), []);

  const empty = editComponents([makeFetchedReply()]).remove(CONTAINER).toJSON();
  assert.deepEqual(empty, []);
});

test("parse: drops junk entries without a valid component type", () => {
  const edited = editComponents([
    makeFetchedReply(),
    {},
    null,
    42,
    { type: 20 }, // a message type sneaking into an array
  ]).toJSON();
  assert.equal(edited.length, 1);
});

test("parse then edit: disable all buttons including future additions", () => {
  const builder = parseComponents(makeBuilt()).disableButtons();
  const rows = builder.toJSON().components;
  const buttons = [];
  for (const child of rows) {
    if (child.type === ROW) {
      for (const inner of child.components) if (inner.type === BUTTON) buttons.push(inner);
    }
  }
  assert.equal(buttons.length, 3);
  // link button also disabled
  assert.ok(buttons.every((b) => b.disabled === true));
});

test("parse then edit: setButtonLabel + replaceText", () => {
  const builder = parseComponents(makeBuilt())
    .setButtonLabel("join", "Голосовать")
    .replaceText("100 монет", "200 монет");

  const texts = builder.getTexts();
  assert.ok(texts.some((t) => t.includes("200 монет")));
  const joinBtn = builder.find("join").component;
  assert.equal(joinBtn.label, "Голосовать");
});

test("editor: remove by customId prunes emptied row", () => {
  const payload = makeBuilt();
  const edited = editComponents(payload).remove("pick").toJSON();
  const rows = flatten(edited).filter((c) => c.type === ROW);
  // first row with buttons stays
  assert.equal(rows.length, 1);
  assert.equal(rows[0].components.length, 3);
});

test("editor: removeButtons removes every button entirely", () => {
  const edited = editComponents(makeBuilt()).removeButtons().toJSON();
  const buttons = flatten(edited).filter((c) => c.type === BUTTON);
  assert.equal(buttons.length, 0);
});

test("editor: keepOnly keeps matching subtree", () => {
  const edited = editComponents(makeBuilt()).keepOnly("join").toJSON();
  const buttons = flatten(edited).filter((c) => c.type === BUTTON);
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].custom_id, "join");
  // container + its row survive, texts and select row are gone
  assert.equal(edited.length, 1);
  assert.deepEqual(flatten(edited).map((c) => c.type), [CONTAINER, ROW, BUTTON]);
});

test("editor: section accessory button gets disabled too", () => {
  const raw = new V2Builder()
    .section({ title: "T", button: { id: "acc", label: "Acc" } })
    .buttons({ id: "b1", label: "B" })
    .toJSON();
  const edited = editComponents(raw).disableButtons().toJSON();
  const buttons = flatten(edited).filter((c) => c.type === BUTTON);
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every((b) => b.disabled));
});

test("editor: removing accessory removes whole section", () => {
  const raw = new V2Builder()
    .text("hello")
    .section({ title: "T", thumbnailUrl: "https://x/y.png" })
    .separator()
    .toJSON();
  const edited = editComponents(raw).remove(ComponentType.Thumbnail).toJSON();
  const types = flatten(edited).map((c) => c.type);
  assert.deepEqual(types, [CONTAINER, TEXT, ComponentType.Separator]);
});

test("editor: input is never mutated", () => {
  const original = makeBuilt();
  const snapshot = JSON.stringify(original);
  editComponents(original).removeButtons().remove("pick");
  assert.equal(JSON.stringify(original), snapshot);
});

test("findComponents returns usable paths", () => {
  const roots = makeBuilt().components;
  const refs = findComponents(roots, "close");
  assert.equal(refs.length, 1);
  assert.equal(refs[0].component.label, "Закрыть");
  assert.ok(refs[0].path.length >= 2); // container -> row -> button
});

test("regex selector matches labels and text content", () => {
  const refs = findComponents(makeBuilt().components, /монет/);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].component.type, TEXT);
});

test("validate catches broken structures", () => {
  const bad = [{ type: ROW, components: [] }];
  const result = validateComponents(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("at least one")));
});

test("parseEmoji variants", () => {
  assert.deepEqual(parseEmoji("<:smile:123>"), { animated: false, name: "smile", id: "123" });
  assert.deepEqual(parseEmoji("<a:dance:456>"), { animated: true, name: "dance", id: "456" });
  assert.deepEqual(parseEmoji("👍"), { name: "👍" });
});

test("send picks reply vs editReply", async () => {
  const calls = [];
  const interactionLike = {
    replied: true,
    editReply: (p) => calls.push(["editReply", p]),
    reply: (p) => calls.push(["reply", p]),
  };
  await new V2Builder().text("hi").send(interactionLike, { ephemeral: true });
  assert.equal(calls[0][0], "editReply");
  assert.equal(calls[0][1].flags & 64, 64);
});

// ------------------------------------------------------------------
// Section management tests
// ------------------------------------------------------------------

function makeSectionsBuilder() {
  return new V2Builder()
    .text("Header")
    .separator()
    .section({ title: "First", content: "Content 1", thumbnailUrl: "https://x/1.png" })
    .separator()
    .section({ title: "Second", content: "Content 2", button: { id: "btn2", label: "B2" } })
    .separator()
    .section({ title: "Third", content: "Content 3", thumbnailUrl: "https://x/3.png" })
    .buttons({ id: "final", label: "Final" });
}

test("getSections: returns all sections with correct indices", () => {
  const builder = makeSectionsBuilder();
  const sections = builder.getSections();
  assert.equal(sections.length, 3);
  assert.equal(sections[0].index, 0);
  assert.equal(sections[1].index, 1);
  assert.equal(sections[2].index, 2);
  assert.equal(sections[0].component.type, ComponentType.Section);
  assert.equal(sections[1].component.type, ComponentType.Section);
  assert.equal(sections[2].component.type, ComponentType.Section);
});

test("getSections: containerIndex reflects position in container array", () => {
  const builder = makeSectionsBuilder();
  const sections = builder.getSections();
  // container: [text(0), sep(1), section(2), sep(3), section(4), sep(5), section(6), row(7)]
  assert.equal(sections[0].containerIndex, 2);
  assert.equal(sections[1].containerIndex, 4);
  assert.equal(sections[2].containerIndex, 6);
});

test("getSection: returns specific section by index", () => {
  const builder = makeSectionsBuilder();
  const s = builder.getSection(1);
  assert.ok(s);
  assert.equal(s.index, 1);
  // Second section has the button accessory
  assert.equal(s.component.accessory.custom_id, "btn2");
});

test("getSection: returns null for out-of-bounds", () => {
  const builder = makeSectionsBuilder();
  assert.equal(builder.getSection(5), null);
  assert.equal(builder.getSection(-1), null);
  assert.equal(builder.getSection(NaN), null);
});

test("removeSection: removes section by index", () => {
  const builder = makeSectionsBuilder();
  const removed = builder.removeSection(1);
  assert.ok(removed);
  const sections = builder.getSections();
  assert.equal(sections.length, 2);
  // First and third remain
  assert.equal(sections[0].component.accessory.type, ComponentType.Thumbnail);
  assert.equal(sections[1].component.accessory.type, ComponentType.Thumbnail);
});

test("removeSection: returns false for out-of-bounds", () => {
  const builder = makeSectionsBuilder();
  // V2Builder.removeSection returns this (for chaining), but nothing changes
  builder.removeSection(10);
  assert.equal(builder.getSections().length, 3);
});

test("removeSection: via ComponentsEditor", () => {
  const raw = makeSectionsBuilder().toJSON();
  const editor = editComponents(raw);
  editor.removeSection(0);
  const sections = editor.getSections();
  assert.equal(sections.length, 2);
  // The first remaining section should be the one originally at index 1 (btn2)
  assert.equal(sections[0].component.accessory.custom_id, "btn2");
});

test("replaceSection: replaces section in-place", () => {
  const builder = makeSectionsBuilder();
  const newSection = {
    type: ComponentType.Section,
    components: [{ type: ComponentType.TextDisplay, content: "**Replaced**\nNew content" }],
    accessory: { type: ComponentType.Thumbnail, media: { url: "https://x/new.png" } },
  };
  const replaced = builder.replaceSection(0, newSection);
  assert.ok(replaced);
  const sections = builder.getSections();
  assert.equal(sections.length, 3);
  // First section replaced
  assert.ok(sections[0].component.components[0].content.includes("Replaced"));
  // Others untouched
  assert.equal(sections[1].component.accessory.custom_id, "btn2");
});

test("replaceSection: returns false for out-of-bounds", () => {
  const builder = makeSectionsBuilder();
  const newSection = { type: ComponentType.Section, components: [], accessory: null };
  // V2Builder.replaceSection returns this (for chaining)
  builder.replaceSection(10, newSection);
  // Nothing changed — still 3 sections
  assert.equal(builder.getSections().length, 3);
});

test("moveSection: reorders sections", () => {
  const builder = makeSectionsBuilder();
  const moved = builder.moveSection(2, 0);
  assert.ok(moved);
  const sections = builder.getSections();
  assert.equal(sections.length, 3);
  // Third section is now first
  assert.equal(sections[0].component.components[0].content.includes("Third"), true);
  // First section is now second
  assert.equal(sections[1].component.components[0].content.includes("First"), true);
  // Second stays
  assert.equal(sections[2].component.components[0].content.includes("Second"), true);
});

test("moveSection: moving to end", () => {
  const builder = makeSectionsBuilder();
  builder.moveSection(0, 5);
  const sections = builder.getSections();
  assert.equal(sections.length, 3);
  // Original first is now last
  assert.equal(sections[2].component.components[0].content.includes("First"), true);
});

test("moveSection: returns false when from is out-of-bounds", () => {
  const builder = makeSectionsBuilder();
  // V2Builder.moveSection returns this (for chaining)
  builder.moveSection(10, 0);
  // Nothing changed
  assert.equal(builder.getSections().length, 3);
});

test("section management: chaining works", () => {
  const builder = makeSectionsBuilder()
    .removeSection(1)
    .moveSection(0, 1);
  const sections = builder.getSections();
  assert.equal(sections.length, 2);
  // removeSection(1) → removes Second; remaining: [First, Third]
  // moveSection(0, 1) → moves First after Third; result: [Third, First]
  assert.equal(sections[0].component.components[0].content.includes("Third"), true);
  assert.equal(sections[1].component.components[0].content.includes("First"), true);
});

test("section management: parse then manipulate", () => {
  const original = makeSectionsBuilder().build();
  const parsed = parseComponents(original);
  parsed.removeSection(0);
  const rebuilt = parsed.build();
  const sections = getSections(rebuilt.components[0].components);
  assert.equal(sections.length, 2);
});

test("section management: standalone functions work on raw arrays", () => {
  const raw = makeSectionsBuilder().toJSON();
  const container = raw; // root is the container
  const sections = getSections(container.components);
  assert.equal(sections.length, 3);

  removeSection(container.components, 1);
  assert.equal(getSections(container.components).length, 2);

  moveSection(container.components, 0, 1);
  const after = getSections(container.components);
  assert.equal(after[0].component.components[0].content.includes("Third"), true);
});

// ------------------------------------------------------------------

function flatten(components) {
  const out = [];
  for (const c of components) {
    out.push(c);
    if (Array.isArray(c.components)) out.push(...flatten(c.components));
    if (c.accessory) out.push(c.accessory);
  }
  return out;
}
