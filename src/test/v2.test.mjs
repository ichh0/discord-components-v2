import assert from "node:assert/strict";
import test from "node:test";
import {
  ComponentType,
  editComponents,
  findComponents,
  getAllByKind,
  getByKind,
  parseComponents,
  parseEmoji,
  removeByKind,
  replaceByKind,
  V2Builder,
  validateComponents,
} from "../../dist/index.js";
import { keepOnly, moveByKind } from "../../dist/advanced.js";

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
  const gallery = payload.components[0].components.find(
    (c) => c.type === ComponentType.MediaGallery,
  );
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
    {
      type: ROW,
      id: 3,
      components: [{ type: BUTTON, style: 2, label: "213", id: 4, custom_id: "a_" }],
    },
    {
      type: ROW,
      id: 5,
      components: [{ type: BUTTON, style: 2, label: "213", id: 6, custom_id: "a__" }],
    },
    {
      type: ROW,
      id: 7,
      components: [{ type: BUTTON, style: 2, label: "213", id: 8, custom_id: "a___" }],
    },
  ];
  const container = {
    type: CONTAINER,
    id: 1,
    accent_color: null,
    spoiler: false,
    components: children,
  };

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
      assert.match(
        key,
        /^(type|id|accent_color|spoiler|components)$/,
        `${name}: junk key "${key}"`,
      );
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
            accessory: {
              type: BUTTON,
              id: 5,
              custom_id: "test2",
              style: 2,
              label: "test",
              disabled: true,
            },
            components: [{ type: TEXT, id: 4, content: "**hello**" }],
          },
          {
            type: ROW,
            id: 6,
            components: [
              {
                type: BUTTON,
                id: 7,
                custom_id: "fff",
                style: 2,
                label: "dsbButtons",
                disabled: true,
              },
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
  edited = editComponents([{ ...fetched }])
    .disableButtons()
    .toJSON();
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

function makeMultiSelect() {
  return new V2Builder()
    .text("Селекты")
    .selectMenu.string({ customId: "pick", options: [{ label: "A", value: "a" }] })
    .selectMenu.role({ customId: "roles" })
    .selectMenu.user({ customId: "users" })
    .toJSON();
}

function fillSelectValues(raw) {
  const components = raw.components ?? raw;
  const values = flatten(components).filter((c) => c.type === ComponentType.StringSelect);
  if (values[0]) {
    values[0].options = [{ label: "A", value: "a", default: true }];
  }
  const roleSel = flatten(components).find((c) => c.type === ComponentType.RoleSelect);
  if (roleSel) roleSel.default_values = [{ id: "111", type: "role" }];
  const userSel = flatten(components).find((c) => c.type === ComponentType.UserSelect);
  if (userSel) userSel.default_values = [{ id: "222", type: "user" }];
  return raw;
}

test("editor: removeSelectMenus removes only matching kinds", () => {
  const edited = editComponents(makeMultiSelect())
    .removeSelectMenus({ type: "role" })
    .toJSON();
  const selects = flatten(edited).filter((c) => c.type !== CONTAINER && c.type === ComponentType.StringSelect || c.type === ComponentType.RoleSelect || c.type === ComponentType.UserSelect);
  assert.deepEqual(
    selects.map((s) => s.custom_id),
    ["pick", "users"],
  );
});

test("editor: removeSelectMenus with a type array filter", () => {
  const edited = editComponents(makeMultiSelect())
    .removeSelectMenus({ type: ["string", "user"] })
    .toJSON();
  const selects = flatten(edited).filter(
    (c) => c.type === ComponentType.StringSelect || c.type === ComponentType.UserSelect || c.type === ComponentType.RoleSelect,
  );
  assert.deepEqual(selects.map((s) => s.custom_id), ["roles"]);
});

test("editor: removeSelectMenus prunes emptied rows", () => {
  const edited = editComponents(makeMultiSelect()).removeSelectMenus().toJSON();
  const rows = flatten(edited).filter((c) => c.type === ROW);
  const selects = flatten(edited).filter((c) => c.type === ComponentType.StringSelect || c.type === ComponentType.UserSelect || c.type === ComponentType.RoleSelect);
  assert.equal(selects.length, 0);
  // only the text + its container remain; all select rows gone
  assert.equal(rows.length, 0);
});

test("editor: clearSelectValues resets defaults so the menu can fire again", () => {
  const raw = fillSelectValues(makeMultiSelect());
  const edited = editComponents(raw).clearSelectValues().toJSON();
  const stringSel = flatten(edited).find((c) => c.type === ComponentType.StringSelect);
  assert.equal("default" in stringSel.options[0], false);
  const roleSel = flatten(edited).find((c) => c.type === ComponentType.RoleSelect);
  assert.equal("default_values" in roleSel, false);
  const userSel = flatten(edited).find((c) => c.type === ComponentType.UserSelect);
  assert.equal("default_values" in userSel, false);
});

test("editor: clearSelectValues filtered by custom_id leaves others", () => {
  const raw = fillSelectValues(makeMultiSelect());
  const edited = editComponents(raw)
    .clearSelectValues({ customIds: "pick" })
    .toJSON();
  const roleSel = flatten(edited).find((c) => c.type === ComponentType.RoleSelect);
  assert.deepEqual(roleSel.default_values, [{ id: "111", type: "role" }]);
});

test("editor: clearSelectValues never mutates the input", () => {
  const raw = fillSelectValues(makeMultiSelect());
  const snapshot = JSON.stringify(raw);
  editComponents(raw).clearSelectValues().removeSelectMenus({ type: "string" });
  assert.equal(JSON.stringify(raw), snapshot);
});

function findStringSelect(edited) {
  return flatten(edited).find((c) => c.type === ComponentType.StringSelect);
}

test("editor: setSelectOptions replaces string-select options", () => {
  const edited = editComponents(makeMultiSelect())
    .setSelectOptions("pick", [
      { label: "X", value: "x", emoji: ":fire:" },
      { label: "Y", value: "y", default: true },
    ])
    .toJSON();
  const sel = findStringSelect(edited);
  assert.deepEqual(sel.options, [
    { label: "X", value: "x", default: false, emoji: { name: "fire" } },
    { label: "Y", value: "y", default: true },
  ]);
});

test("editor: setSelectPlaceholder sets and removes", () => {
  let edited = editComponents(makeMultiSelect())
    .setSelectPlaceholder("pick", "Выбери")
    .toJSON();
  assert.equal(findStringSelect(edited).placeholder, "Выбери");
  edited = editComponents(edited).setSelectPlaceholder("pick", undefined).toJSON();
  assert.equal("placeholder" in findStringSelect(edited), false);
});

test("editor: setSelectMinMaxValues sets and removes", () => {
  let edited = editComponents(makeMultiSelect())
    .setSelectMinMaxValues("pick", 0, 3)
    .toJSON();
  const sel = findStringSelect(edited);
  assert.equal(sel.min_values, 0);
  assert.equal(sel.max_values, 3);
  edited = editComponents(edited).setSelectMinMaxValues("pick", undefined, 1).toJSON();
  const sel2 = findStringSelect(edited);
  assert.equal("min_values" in sel2, false);
  assert.equal(sel2.max_values, 1);
});

test("editor: setSelectDisabled + enable", () => {
  const edited = editComponents(makeMultiSelect())
    .setSelectDisabled()
    .setSelectDisabled({ type: ["role", "user"] }, false)
    .toJSON();
  const selects = flatten(edited).filter((c) => c.type === ComponentType.StringSelect || c.type === ComponentType.RoleSelect || c.type === ComponentType.UserSelect);
  const byId = Object.fromEntries(selects.map((s) => [s.custom_id, s.disabled]));
  assert.equal(byId.pick, true);
  assert.equal(byId.roles, false);
  assert.equal(byId.users, false);
});

test("editor: getSelectMenus / findSelectMenu indexing", () => {
  const editor = editComponents(makeMultiSelect());
  assert.deepEqual(
    editor.getSelectMenus({ type: "user" }).map((s) => s.custom_id),
    ["users"],
  );
  assert.equal(editor.findSelectMenu({ customIds: "roles" }).custom_id, "roles");
  assert.equal(editor.findSelectMenu({ type: "channel" }), null);
});

test("editor: replaceSelectMenu swaps the menu in place", () => {
  const replacement = { type: ComponentType.Button, style: 2, label: "Go", custom_id: "go" };
  const edited = editComponents(makeMultiSelect())
    .replaceSelectMenu({ customIds: "roles" }, replacement)
    .toJSON();
  const flat = flatten(edited);
  assert.equal(flat.some((c) => c.type === ComponentType.RoleSelect && c.custom_id === "roles"), false);
  assert.equal(flat.some((c) => c.type === ComponentType.Button && c.custom_id === "go"), true);
});

test("editor: setButtonStyle keeps payload valid across link switch", () => {
  const edited = editComponents(makeBuilt())
    .setButtonStyle("join", 1)
    .setButtonStyle("close", 2)
    .toJSON();
  const buttons = flatten(edited).filter(
    (c) => c.type === BUTTON && (c.custom_id === "join" || c.custom_id === "close"),
  );
  for (const b of buttons) {
    assert.equal(b.style, b.custom_id === "join" ? 1 : 2);
    assert.equal("url" in b, false);
    assert.equal(typeof b.custom_id, "string");
  }
});

test("editor: setButtonUrl converts to link button", () => {
  const edited = editComponents(makeBuilt())
    .setButtonUrl("join", "https://example.com")
    .toJSON();
  const btn = flatten(edited).find((c) => c.type === BUTTON && c.url === "https://example.com");
  assert.equal(btn.style, 5);
  assert.equal(btn.url, "https://example.com");
  assert.equal("custom_id" in btn, false);
});

test("editor: setButtonEmoji sets from string and removes", () => {
  let edited = editComponents(makeBuilt()).setButtonEmoji("join", "<:join:123>").toJSON();
  let btn = flatten(edited).find((c) => c.type === BUTTON && c.custom_id === "join");
  assert.deepEqual(btn.emoji, { name: "join", id: "123" });
  edited = editComponents(edited).setButtonEmoji("join", undefined).toJSON();
  btn = flatten(edited).find((c) => c.type === BUTTON && c.custom_id === "join");
  assert.equal("emoji" in btn, false);
});

test("editor: renameCustomId renames everywhere and throws when missing", () => {
  const edited = editComponents(makeMultiSelect()).renameCustomId("pick", "pick2").toJSON();
  assert.equal(findStringSelect(edited).custom_id, "pick2");
  assert.throws(() => editComponents(makeMultiSelect()).renameCustomId("nope", "x"));
});

test("advanced: keepOnly keeps matching subtree", () => {
  const payload = makeBuilt();
  const container = payload.components[0];
  const children = container.components; // owned array, mutated in place
  const kept = keepOnly(children, "join");
  assert.equal(kept, children);
  const edited = [container];
  const buttons = flatten(edited).filter((c) => c.type === BUTTON);
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].custom_id, "join");
  // container + its row survive, texts and select row are gone
  assert.equal(edited.length, 1);
  assert.deepEqual(
    flatten(edited).map((c) => c.type),
    [CONTAINER, ROW, BUTTON],
  );
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
  assert.deepEqual(parseEmoji("<:smile:123>"), { name: "smile", id: "123" });
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

test("all sections: returns all sections with correct indices", () => {
  const builder = makeSectionsBuilder();
  const sections = builder.all("section");
  assert.equal(sections.length, 3);
  assert.equal(sections[0].index, 0);
  assert.equal(sections[1].index, 1);
  assert.equal(sections[2].index, 2);
  assert.equal(sections[0].component.type, ComponentType.Section);
  assert.equal(sections[1].component.type, ComponentType.Section);
  assert.equal(sections[2].component.type, ComponentType.Section);
});

test("all sections: containerIndex reflects position in container array", () => {
  const builder = makeSectionsBuilder();
  const sections = builder.all("section");
  // container: [text(0), sep(1), section(2), sep(3), section(4), sep(5), section(6), row(7)]
  assert.equal(sections[0].containerIndex, 2);
  assert.equal(sections[1].containerIndex, 4);
  assert.equal(sections[2].containerIndex, 6);
});

test("get section: returns specific section by index", () => {
  const builder = makeSectionsBuilder();
  const s = builder.get("section", 1);
  assert.ok(s);
  assert.equal(s.index, 1);
  // Second section has the button accessory
  assert.equal(s.component.accessory.custom_id, "btn2");
});

test("get section: returns null for out-of-bounds", () => {
  const builder = makeSectionsBuilder();
  assert.equal(builder.get("section", 5), null);
  assert.equal(builder.get("section", -1), null);
  assert.equal(builder.get("section", NaN), null);
});

test("remove section: removes section by index", () => {
  const builder = makeSectionsBuilder();
  const removed = builder.remove("section", 1);
  assert.equal(removed, builder); // chainable
  const sections = builder.all("section");
  assert.equal(sections.length, 2);
  // First and third remain
  assert.equal(sections[0].component.accessory.type, ComponentType.Thumbnail);
  assert.equal(sections[1].component.accessory.type, ComponentType.Thumbnail);
});

test("remove section: no-op out-of-bounds", () => {
  const builder = makeSectionsBuilder();
  builder.remove("section", 10);
  assert.equal(builder.all("section").length, 3);
});

test("remove section: via ComponentsEditor", () => {
  const raw = makeSectionsBuilder().toJSON();
  const editor = editComponents(raw);
  editor.remove("section", 0);
  const sections = editor.all("section");
  assert.equal(sections.length, 2);
  // The first remaining section should be the one originally at index 1 (btn2)
  assert.equal(sections[0].component.accessory.custom_id, "btn2");
});

test("replace section: replaces section in-place", () => {
  const builder = makeSectionsBuilder();
  const newSection = {
    type: ComponentType.Section,
    components: [{ type: ComponentType.TextDisplay, content: "**Replaced**\nNew content" }],
    accessory: { type: ComponentType.Thumbnail, media: { url: "https://x/new.png" } },
  };
  const replaced = builder.replace({ kind: "section", index: 0 }, newSection);
  assert.equal(replaced, builder); // chainable
  const sections = builder.all("section");
  assert.equal(sections.length, 3);
  // First section replaced
  assert.ok(sections[0].component.components[0].content.includes("Replaced"));
  // Others untouched
  assert.equal(sections[1].component.accessory.custom_id, "btn2");
});

test("replace section: no-op out-of-bounds", () => {
  const builder = makeSectionsBuilder();
  builder.replace({ kind: "section", index: 10 }, { type: ComponentType.Section, components: [], accessory: null });
  // Nothing changed — still 3 sections
  assert.equal(builder.all("section").length, 3);
});

test("move section: reorders sections", () => {
  const builder = makeSectionsBuilder();
  const moved = builder.move("section", 2, 0);
  assert.equal(moved, builder); // chainable
  const sections = builder.all("section");
  assert.equal(sections.length, 3);
  // Third section is now first
  assert.equal(sections[0].component.components[0].content.includes("Third"), true);
  // First section is now second
  assert.equal(sections[1].component.components[0].content.includes("First"), true);
  // Second stays
  assert.equal(sections[2].component.components[0].content.includes("Second"), true);
});

test("move section: moving to end", () => {
  const builder = makeSectionsBuilder();
  builder.move("section", 0, 5);
  const sections = builder.all("section");
  assert.equal(sections.length, 3);
  // Original first is now last
  assert.equal(sections[2].component.components[0].content.includes("First"), true);
});

test("move section: no-op when from is out-of-bounds", () => {
  const builder = makeSectionsBuilder();
  builder.move("section", 10, 0);
  // Nothing changed
  assert.equal(builder.all("section").length, 3);
});

test("section management: chaining works", () => {
  const builder = makeSectionsBuilder()
    .remove("section", 1)
    .move("section", 0, 1);
  const sections = builder.all("section");
  assert.equal(sections.length, 2);
  // remove(1) → removes Second; remaining: [First, Third]
  // move(0, 1) → moves First after Third; result: [Third, First]
  assert.equal(sections[0].component.components[0].content.includes("Third"), true);
  assert.equal(sections[1].component.components[0].content.includes("First"), true);
});

test("section management: parse then manipulate", () => {
  const original = makeSectionsBuilder().build();
  const parsed = parseComponents(original);
  parsed.remove("section", 0);
  const rebuilt = parsed.build();
  const sections = getAllByKind(rebuilt.components[0].components, "section");
  assert.equal(sections.length, 2);
});

test("section management: standalone functions work on raw arrays", () => {
  const raw = makeSectionsBuilder().toJSON();
  const container = raw; // root is the container
  const sections = getAllByKind(container.components, "section");
  assert.equal(sections.length, 3);

  removeByKind(container.components, "section", 1);
  assert.equal(getAllByKind(container.components, "section").length, 2);

  replaceByKind(container.components, "section", 0, {
    type: ComponentType.Section,
    components: [{ type: ComponentType.TextDisplay, content: "**Swap**\nReplaced" }],
    accessory: { type: ComponentType.Thumbnail, media: { url: "https://x/swapped.png" } },
  });
  const afterReplace = getAllByKind(container.components, "section");
  assert.ok(afterReplace[0].component.components[0].content.includes("Swap"));

  moveByKind(container.components, "section", 0, 1);
  const after = getAllByKind(container.components, "section");
  assert.equal(after[0].component.components[0].content.includes("Third"), true);
});

test("section management: namespace accessors", () => {
  const builder = makeSectionsBuilder();
  assert.equal(builder.sections.all().length, 3);
  assert.equal(builder.sections.get(1).component.accessory.custom_id, "btn2");
  builder.sections.remove(1).sections.move(0, 1);
  const sections = builder.sections.all();
  assert.equal(sections.length, 2);
  assert.equal(sections[0].component.components[0].content.includes("Third"), true);

  const editor = editComponents(makeSectionsBuilder().toJSON());
  editor.sections.remove(0);
  assert.equal(editor.sections.all().length, 2);
  assert.equal(editor.sections.get(0).component.accessory.custom_id, "btn2");
});

// ------------------------------------------------------------------
// Separator management tests
// ------------------------------------------------------------------

const SEP = ComponentType.Separator;

/** container layout: text(0) sep(1) section(2) sep(3) text(4) sep(5) row(6) sep(7) gallery(8) */
function makeSeparatorsBuilder() {
  return new V2Builder()
    .text("Header")
    .separator()
    .section({ title: "A", content: "One", thumbnailUrl: "https://x/1.png" })
    .separator()
    .text("Middle")
    .separator()
    .buttons({ id: "join", label: "Join" })
    .separator()
    .mediaUrl("https://x/g.png");
}

test("all separators: returns all separators with correct indices", () => {
  const builder = makeSeparatorsBuilder();
  const seps = builder.all("separator");
  assert.equal(seps.length, 4);
  assert.deepEqual(
    seps.map((s) => s.index),
    [0, 1, 2, 3],
  );
  assert.ok(seps.every((s) => s.component.type === SEP));
});

test("all separators: containerIndex reflects position in container array", () => {
  const builder = makeSeparatorsBuilder();
  const seps = builder.all("separator");
  assert.deepEqual(
    seps.map((s) => s.containerIndex),
    [1, 3, 5, 7],
  );
});

test("get separator: returns a specific separator and null out-of-bounds", () => {
  const builder = makeSeparatorsBuilder();
  assert.equal(builder.get("separator", 2).containerIndex, 5);
  assert.equal(builder.get("separator", 10), null);
  assert.equal(builder.get("separator", -1), null);
  assert.equal(builder.get("separator", NaN), null);
});

test("remove separator: removes the right separator and keeps a valid body", () => {
  const builder = makeSeparatorsBuilder();
  builder.remove("separator", 1); // the separator right after the section
  const seps = builder.all("separator");
  assert.equal(seps.length, 3);
  // original containerIndexes [1,3,5,7]; removing position 3 shifts the rest down
  assert.deepEqual(
    seps.map((s) => s.containerIndex),
    [1, 4, 6],
  );
  // the payload still validates
  const payload = builder.build();
  assert.deepEqual(payload.components, [builder.toJSON()]);
  assert.equal(validateComponents(payload.components).valid, true);
});

test("remove separator: via ComponentsEditor", () => {
  const editor = editComponents(makeSeparatorsBuilder().toJSON());
  editor.remove("separator", 0);
  const seps = editor.all("separator");
  assert.equal(seps.length, 3);
});

test("replace separator: replaces in-place and keeps shape", () => {
  const builder = makeSeparatorsBuilder();
  const replacement = { type: SEP, spacing: 2, divider: false };
  const ok = builder.replace({ kind: "separator", index: 0 }, replacement);
  assert.equal(ok, builder); // chainable
  assert.deepEqual(builder.get("separator", 0).component, replacement);
  assert.equal(builder.toJSON().components[1].type, SEP);
});

test("replace separator: no-op out-of-bounds", () => {
  const builder = makeSeparatorsBuilder();
  builder.replace({ kind: "separator", index: 10 }, { type: SEP });
  assert.equal(builder.all("separator").length, 4); // nothing changed
});

test("move separator: reorders separators", () => {
  const builder = makeSeparatorsBuilder();
  builder.move("separator", 0, 2); // move first separator to third slot
  const seps = builder.all("separator");
  assert.equal(seps.length, 4);
  // order becomes [orig1, orig2, orig0, orig3]
  assert.deepEqual(
    seps.map((s) => s.containerIndex),
    [2, 4, 6, 7],
  );
});

test("remove separator: chain of removals keeps build() valid", () => {
  const builder = makeSeparatorsBuilder()
    .remove("separator", 0)
    .remove("separator", 0)
    .remove("separator", 0);
  assert.equal(builder.all("separator").length, 1);
  const payload = builder.build(); // must not throw
  assert.equal(payload.components[0].components.filter((c) => c.type === SEP).length, 1);
});

test("separators: standalone functions work on raw container children", () => {
  const raw = makeSeparatorsBuilder().toJSON();
  const children = raw.components;
  assert.equal(getAllByKind(children, "separator").length, 4);
  assert.equal(getByKind(children, "separator", 1).containerIndex, 3);
  assert.equal(removeByKind(children, "separator", 1), true);
  assert.equal(getAllByKind(children, "separator").length, 3);
  assert.equal(moveByKind(children, "separator", 0, 2), true);
});

// ------------------------------------------------------------------
// TextDisplay / MediaGallery / ActionRow management tests
// ------------------------------------------------------------------

test("textDisplays / actionRows / mediaGalleries kind access", () => {
  const builder = makeSeparatorsBuilder(); // two text blocks, one row, one gallery
  const texts = builder.all("textDisplay");
  assert.equal(texts.length, 2);
  assert.equal(builder.get("textDisplay", 0).component.content, "Header");

  builder.remove("textDisplay", 1); // remove "Middle"
  assert.equal(builder.all("textDisplay").length, 1);
  assert.equal(builder.get("textDisplay", 0).component.content, "Header");

  // still a valid payload
  assert.equal(validateComponents(builder.build().components).valid, true);
});

test("actionRows: kind access and removal", () => {
  const builder = makeSeparatorsBuilder(); // one buttons row
  assert.equal(builder.all("actionRow").length, 1);
  assert.equal(builder.get("actionRow", 0).component.components.length, 1);
  assert.equal(builder.get("actionRow", 5), null);

  builder.remove("actionRow", 0);
  assert.equal(builder.all("actionRow").length, 0);
  assert.equal(builder.toJSON().components.filter((c) => c.type === ROW).length, 0);
  assert.equal(validateComponents(builder.build().components).valid, true);
});

test("mediaGalleries: kind access and removal", () => {
  const builder = makeSeparatorsBuilder(); // one gallery at the end
  assert.equal(builder.all("mediaGallery").length, 1);
  assert.equal(builder.get("mediaGallery", 0).component.type, ComponentType.MediaGallery);

  const gallery = builder.get("mediaGallery", 0);
  assert.equal(gallery.component.items[0].media.url, "https://x/g.png");

  builder.remove("mediaGallery", 0);
  assert.equal(builder.all("mediaGallery").length, 0);
  assert.equal(validateComponents(builder.build().components).valid, true);
});

test("alone-standing kind namespaces set strings for text displays", () => {
  const builder = makeSeparatorsBuilder();
  builder.textDisplays.set(1, "Замена");
  assert.equal(builder.get("textDisplay", 1).component.content, "Замена");
  assert.throws(() => builder.sections.set(0, "nope"), /plain strings/);
  assert.throws(() => builder.textDisplays.set(9, "x"), /no textDisplay at index 9/);
});

test("layout management: robust to full removal via editor", () => {
  const editor = editComponents(makeSeparatorsBuilder().toJSON());
  editor.remove("separator", 0).remove("separator", 0).remove("textDisplay", 0);

  const payload = editor.toJSON();
  assert.equal(validateComponents(payload).valid, true);
  // container still present as single root
  assert.equal(payload.length, 1);
  assert.equal(payload[0].type, CONTAINER);
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
