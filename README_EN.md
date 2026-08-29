# 📦 discordjs-components-v2 v2

[![npm version](https://badge.fury.io/js/discordjs-components-v2.svg)](https://www.npmjs.com/package/discordjs-components-v2)
[![GitHub license](https://img.shields.io/github/license/ichh0/discord-components-v2)](https://github.com/ichh0/discord-components-v2/blob/main/license)

[🇷🇺 Русский](README.md)

A library for **Discord Components V2**: a builder, a parser and editing utilities — **cache-free**.

The core idea: components are plain JSON. Discord itself returns the full component tree in `message.components`, so you don't need to store message state anywhere: fetch → parse → edit → send.

> [!NOTE]
> Built on plain `discord-api-types/v10` structures. discord.js is not required at runtime nor as a peer dependency — the output is fully compatible with discord.js v14 (pass JSON straight into `components:`).

### ✨ Features

- **`V2Builder`** — declarative fluent component building: text, buttons, selects, sections, separators, galleries, attachments, ANSI tables.
- **Cache-free parsing** — `parseComponents()` / `V2Builder.parse()` turn `message.components` back into a builder.
- **Editing utilities** — `editComponents()` / `ComponentsEditor`: remove, replace, move, disable buttons, rewrite text/sections/galleries.
- **V2 modals** — `V2ModalBuilder`: flat field declarations + post-add mutation, typed submit parsing (`parseSubmit`), `.from()`, validation and `rule()`.
- **State in `customId`** — `CustomIdBuilder`: a `name:entityId:executorId` codec with a hard ≤100-character guarantee.
- **Validation** — `validateComponents()` / `build()` catch Discord limits before sending.

---

## 📦 Install

```bash
npm install discordjs-components-v2 discord-api-types
```

## 🚀 Quick start

```ts
import { V2Builder } from "discordjs-components-v2";

const payload = new V2Builder()
  .color(0xffaa00)
  .text("# 🎉 Giveaway")
  .field("Prize", "100 coins")
  .buttons(
    { id: "join", label: "Join", style: "Success", emoji: "🎟️" },
    { url: "https://example.com", label: "Rules" },
  )
  .selectMenu.string({
    customId: "category",
    placeholder: "Pick a category",
    options: [
      { label: "Games", value: "games", emoji: "🎮" },
      { label: "Skins", value: "skins" },
    ],
  })
  .build(); // → { components, files?, flags: 32768 }

await interaction.reply(payload);
```

`build()` returns a ready payload: `{ content?, components, files?, flags }`. Spread it manually or call `await builder.send(interaction, { ephemeral? })` — it picks `reply` / `editReply` automatically.

---

## ♻️ Cache-free parsing (the main feature)

```ts
// later, any time:
const message = await interaction.fetchReply();

const builder = parseComponents(message); // raw JSON → builder

builder
  .replaceText("0 participants", "1 participant")
  .setButtonLabel("join", "Giveaway closed")
  .disableButtons(); // disables every button, including section accessory buttons

await builder.send(interaction); // editReply under the hood
```

`parseComponents()` / `V2Builder.parse()` accepts:

| Input | Example |
|---|---|
| raw component array | `[...message.components]` |
| message-like object | `{ components: [...], content }` (fetched Message works too) |
| single component | `{ type: 17, components: [...] }` |
| anything with `.toJSON()` | discord.js builders / component instances |

If there is exactly one root and it's a Container, it is absorbed with all metadata (accent color, spoiler, children). Otherwise everything is wrapped into an implicit container so the fluent API keeps working.

## 🔧 Editing utilities

### `editComponents(data)` — chainable editor over raw components

```ts
import { editComponents } from "discordjs-components-v2";

const components = editComponents(await interaction.fetchReply())
  .disableButtons()              // disable all buttons
  .enableButtons("open")         // …except one
  .removeButtons("rules")        // remove the rules button entirely
  .remove("pick")                // remove any component by customId
  .keepOnly(/giveaway/i)         // keep only matches (+ their ancestors)
  .setButtonLabel("join", "Vote")
  .replaceText("100 coins", "200 coins")
  .toJSON();

await interaction.editReply({ components, flags: 32768 });
```

Input data is never mutated — the editor works on a deep copy.

Whole message objects are accepted too (`await ctx.fetchReply()`, a discord.js `Message` instance, or its `toJSON()`), including wrapped in an array: a message is detected by its type (0/19/20/… — not a component type) and unwrapped to its `components`. A message without components yields an empty array; junk entries without a valid `type` are dropped. Message flags are NOT carried over — see below.

> ⚠️ **When editing a CV2 message, keep the `IS_COMPONENTS_V2` (32768) flag.** Without it Discord rejects containers with the same `UNION_TYPE_CHOICES` error. Easiest: reuse the fetched message's flags:
>
> ```ts
> const fetched = await ctx.fetchReply();
> await ctx.editReply({
>   components: editComponents(fetched).disableButtons().toJSON(),
>   flags: fetched.flags, // already contains IS_COMPONENTS_V2
> });
> ```

Automatic cleanup after removals: empty ActionRows are pruned; a Section without texts or without an accessory is removed entirely (Discord rejects those).

### Select menus: removal, clearing and editing

`removeSelectMenus({ type, customIds })` removes selects by kind and/or `custom_id` (emptied rows are pruned automatically), `clearSelectValues(...)` resets the previously chosen value — so the same menu can fire again:

```ts
editComponents(await interaction.fetchReply())
  .removeSelectMenus({ type: "string" })          // drop every string select
  .removeSelectMenu({ type: ["role", "user"], customIds: "filter" }) // alias of removeSelectMenus
  .clearSelectValues({ type: "mentionable" })     // reset the selection (default_values / default)
  .getSelectMenus({ type: "user" })               // find selects (array of raw components)
  .findSelectMenu({ customIds: "pick" })          // first match or null
  .setSelectPlaceholder("pick", "Pick one")       // placeholder (undefined removes it)
  .setSelectOptions("pick", [                     // replace a string select's options
    { label: "X", value: "x", emoji: ":fire:" },
    { label: "Y", value: "y", default: true },
  ])
  .setSelectMinMaxValues("pick", 1, 3)            // min/max (undefined removes)
  .setSelectDisabled({ type: "role" })            // disable (false re-enables)
  .replaceSelectMenu({ customIds: "roles" }, { type: 2, style: 1, label: "Go", custom_id: "go" })
  .toJSON();
```

Buttons: `setButtonStyle(customId, style)` (switching to Link drops `custom_id`, leaving it drops `url`), `setButtonEmoji(customId, emoji?)` (same string format as `parseEmoji`; `undefined` removes), `setButtonUrl(customId, url?)` (converts to a Link button; `undefined` removes), `renameCustomId(from, to)` (renames `custom_id` everywhere, throws if nothing matched).

Also available on `V2Builder`/`parseComponents` and as standalone functions. `type`: `"string" | "user" | "role" | "channel" | "mentionable"` (or an array); the `customIds` filter is a string or an array.

### Selectors

Every search/removal API uses one unified selector:

- `"my_id"` — exact `custom_id` match
- `ComponentType.Button` — exact type
- `/regex/i` — tested against `custom_id`, button labels and TextDisplay content
- `(c) => boolean` — custom predicate

### Search & info extraction

```ts
builder.find("join");            // ComponentRef | null — node + path + parent
builder.findAll(ComponentType.TextDisplay);
builder.getTexts();              // contents of every text block

findComponents(rawArray, selector); // standalone version
```

## 🧱 Builder methods

| Method | Purpose |
|---|---|
| `.text(md)` | TextDisplay with markdown |
| `.content(str)` | plain content above components |
| `.field(name, value, inline?)` | name/value pair |
| `.fields([...])` | aligned two-column table inside ```ansi``` |
| `.buttons(...)` | row of ≤5 buttons (`id`/`url`/`skuId`, style as string: `"Primary"`…) |
| `.selectMenu.string/user/role/mentionable/channel(params)` | select menu in its own row |
| `.section({ title, content?, thumbnailUrl?, button?, spoiler? })` | Section with thumbnail or button accessory |
| `.gallery(urls \| items)` | MediaGallery up to 10 images |
| `.media(buffer, name?)` | attachment + `attachment://…` gallery |
| `.file(bufferOrPayload, name?, spoiler?)` | File component |
| `.separator(size?, divider?)` | separator |
| `.color(hex)` / `.spoiler(bool)` | container accent/spoiler |
| `.setId(n)` | numeric container id |
| `.clear()` / `.getAttachments()` | reset state / files |

Editing methods are available right on the builder: `disableButtons`, `enableButtons`, `setDisabled`, `setButtonLabel`, `setButtonStyle`, `setButtonEmoji`, `setButtonUrl`, `remove`, `removeButtons`, `removeSelectMenus`/`removeSelectMenu`, `clearSelectValues`, `setSelectPlaceholder`, `setSelectOptions`, `setSelectMinMaxValues`, `setSelectDisabled`, `getSelectMenus`, `findSelectMenu`, `replaceSelectMenu`, `renameCustomId`, `keepOnly`, `replaceText`, `find`, `findAll`, `getTexts`.

## 📝 Modals (`V2ModalBuilder`)

A simplified wrapper over the Components V2 modal API — describe the form with plain option objects instead of manually juggling `LabelBuilder` + inner builders. Every interactive field is automatically wrapped in a `LabelBuilder`.

```ts
import { V2ModalBuilder } from "discordjs-components-v2";

const modal = new V2ModalBuilder()
  .setTitle("Create set")
  .setCustomId(`createNabor_modal:${executorId}`)
  .textInput({
    label: "Set name",
    customId: "name_nabor",
    minLength: 3,
    maxLength: 15,
    placeholder: "e.g. Moderator",
    required: true,
  })
  .roleSelect({ label: "Pick a role", customId: "give_role", required: true })
  .channelSelect({ label: "Publish channel", customId: "publish_channel", maxValues: 1, minValues: 1, channelTypes: [0] })
  .radioGroup({
    label: "Input type",
    customId: "type_input",
    options: [
      { label: "Single-line", value: "short", description: "One line" },
      { label: "Multi-line", value: "long", description: "One or more" },
    ],
  })
  .build();

await interaction.showModal(modal);
```

Fields: `.textInput(...)` (style `"short"`/`"paragraph"`, `value` prefill), `.roleSelect(...)`, `.channelSelect(...)`, `.userSelect(...)`, `.mentionableSelect(...)`, `.stringSelect(...)` (emoji as a string: `"👍"`, `":name:"`, `"<:name:id>"`), `.radioGroup(...)`, plus `.setTitle()` / `.setCustomId()` / `.build()`. Passing `value: undefined` is safe — the value is simply not set.

### Mutating fields after adding

The value is often only known after some checks (e.g. when editing a question). Every added field is reachable by its `customId` as a live discord.js builder — mutations are reflected in the already-built modal:

```ts
const v2Modal = new V2ModalBuilder({ customId, title })
  .textInput({ label: "Enter the question", customId: "question", minLength: 5, maxLength: 45 })
  .textInput({ label: "Hint", customId: "placeholder", style: "paragraph" })
  .radioGroup({ label: "Input type", customId: "type_input", options });

if (isUpdate) v2Modal.setTextInputValue("question", questionData.label);

const input = v2Modal.component("placeholder"); // live TextInputBuilder
input.setPlaceholder("new placeholder");         // mutate directly
input.setRequired(true);

await ctx.showModal(v2Modal.build());
```

| Method | Returns |
|---|---|
| `.component(customId)` | live field builder (`TextInputBuilder` / select / `RadioGroupBuilder`) or `undefined` |
| `.textInputComponent(customId)` | `TextInputBuilder \| undefined` — text inputs only |
| `.setTextInputValue(customId, value)` | chainable value setter (`this`), throws for unknown `customId` or non-text field |
| `.inner` | underlying discord.js `ModalBuilder` (rarely needed) |

Anything can be mutated through the returned builder: `.setValue()`, `.setRequired()`, `.setPlaceholder()`, `.setOptions()`, `.setDefaultRoles()` and so on.

Default-value setters for selects and radio (defaults can be changed even after the field was added):

| Method | What it does |
|---|---|
| `.setRadioGroupDefault(customId, value)` | mark a radio option (throws if the option doesn't exist) |
| `.setStringSelectDefaults(customId, values[])` | mark multi-select values |
| `.setRoleSelectDefaults(customId, roleIds[])` | default roles |
| `.setChannelSelectDefaults(customId, channelIds[])` | default channels |
| `.setUserSelectDefaults(customId, userIds[])` | default users |
| `.setMentionableSelectDefaults(customId, defaults[])` | defaults for mentionable: `{ id, type: "user" \| "role" }[]` |

```ts
const modal = new V2ModalBuilder({ title: "Filter", customId: "filter" })
  .stringSelect({ label: "Channels", customId: "chs", options })
  .radioGroup({ label: "Direction", customId: "dir", options: dirOptions });

if (savedFilter) {
  modal.setStringSelectDefaults("chs", savedFilter.channels);
  modal.setRadioGroupDefault("dir", savedFilter.direction);
}
```

### Parsing the submit

`parseSubmit()` reads values by `customId` straight from the interaction into a typed object — no manual casts or one-by-one `getTextInputValue()` calls:

```ts
const query = modal.parseSubmit(interaction); // ModalSubmitInteraction

query.name_nabor;      // string — textInput
query.type_input;      // string | null — radio
query.give_role;       // string[] | null — checked role ids (or users/channels/mentionables)
query.publish_channel; // string[] | null
```

The shape is taken automatically from the added fields; get it separately via `.getSchema()` — an array of `{ customId, kind }` (`"text_input" | "radio_group" | "string_select" | "role_select" | "channel_select" | "user_select" | "mentionable_select"`). For fields outside the builder there's the standalone `parseModalSubmit(interaction, schema)` function.

### Restoring from JSON

`.from()` rebuilds a modal from JSON / a discord.js `ModalBuilder` — handy for migrating legacy code (plain `ActionRow` + `TextInput`) or storing presets:

```ts
const rebuilt = V2ModalBuilder.from(savedModalJson).build();
```

### Validation and `show()`

`build()` validates the form before assembling it and throws an `Error` listing every problem: missing `title`/`custom_id`, duplicate `customId`s, `minLength > maxLength`, `minValues > maxValues`, plus errors from custom rules:

```ts
const modal = new V2ModalBuilder({ title: "Range", customId: "range" })
  .textInput({ label: "min", customId: "min_values" })
  .textInput({ label: "max", customId: "max_values" })
  .rule((b) => {
    const min = Number(b.textInputComponent("min_values")?.data.value);
    const max = Number(b.textInputComponent("max_values")?.data.value);
    return Number.isFinite(min) && Number.isFinite(max) && min > max
      ? "min cannot be greater than max"
      : null;
  });

modal.setTextInputValue("min_values", "10").setTextInputValue("max_values", "5");
modal.build(); // throws — the rule returned an error string
```

`.validate()` returns an array of problem strings (empty = all good), and `.show(target)` shows the modal right away:

```ts
await newsV2Modal.show(interaction); // eqv. interaction.showModal(newsV2Modal.build())
```

## 🧩 Section & layout-component management

`V2Builder` and `ComponentsEditor` let you flexibly manage components inside the container by their index: sections (`Section`), separators (`Separator`), text blocks (`TextDisplay`), galleries (`MediaGallery`) and action rows (`ActionRow`). Each type is indexed independently (only siblings of the same type are counted), and any of them can be removed, replaced or reordered.

| Method | Purpose |
|---|---|
| `.getSections()` · `.getSection(i)` | list / one section: `{ index, component, containerIndex }` |
| `.removeSection(i)` · `.replaceSection(i, r)` · `.moveSection(from, to)` | remove / replace / move a section |
| `.getSeparators()` · `.getSeparator(i)` | list / one separator |
| `.removeSeparator(i)` · `.replaceSeparator(i, r)` · `.moveSeparator(from, to)` | remove / replace / move a separator |
| `.getTextDisplays()` · `.getTextDisplay(i)` | list / one text block |
| `.removeTextDisplay(i)` · `.replaceTextDisplay(i, r)` · `.moveTextDisplay(from, to)` | remove / replace / move a text block |
| `.getMediaGalleries()` · `.getMediaGallery(i)` | list / one gallery |
| `.removeMediaGallery(i)` · `.replaceMediaGallery(i, r)` · `.moveMediaGallery(from, to)` | remove / replace / move a gallery |
| `.getActionRows()` · `.getActionRow(i)` | list / one action row |
| `.removeActionRow(i)` · `.replaceActionRow(i, r)` · `.moveActionRow(from, to)` | remove / replace / move an action row |

All *remove / replace / move* methods return `this` for chaining.

```ts
const builder = V2Builder.parse(message);

// How many sections are there?
const sections = builder.getSections(); // [{ index: 0, component, containerIndex: 2 }, ...]

// Remove the second separator
builder.removeSeparator(1);

// Drop every separator between sections
while (builder.getSeparators().length) builder.removeSeparator(0);

// Remove one text block
builder.removeTextDisplay(0);

// Replace the first section entirely
builder.replaceSection(0, {
  type: ComponentType.Section,
  components: [{ type: ComponentType.TextDisplay, content: "**New title**\nNew content" }],
  accessory: { type: ComponentType.Thumbnail, media: { url: "https://example.com/img.png" } },
});

// Move the last section to the top
builder.moveSection(2, 0);

// Chaining: drop one section and reorder the rest
builder.removeSection(1).moveSection(0, 1);

await builder.send(interaction);
```

The same operations are available through `ComponentsEditor`:

```ts
editComponents(message)
  .removeSeparator(1)
  .removeTextDisplay(0)
  .getSections();
```

And as standalone functions over a raw container-children array (`getSections`, `getSection`, `removeSection`, `replaceSection`, `moveSection`, `getSeparators`, `getSeparator`, `removeSeparator`, `replaceSeparator`, `moveSeparator`, …) — these auto-expand a root container:

```ts
import { getSeparators, removeSeparator, moveSeparator } from "discordjs-components-v2";

const seps = getSeparators(container.components); // [SeparatorRef]
removeSeparator(container.components, 1);
moveSeparator(container.components, 2, 0);
```

## 🆔 State in `customId` (`CustomIdBuilder`)

Cache-free components = state lives in `custom_id` itself. A one-liner codec of `name:entityId:executorId:rest…` format (separator is always `:`) with the same rules as the classic `CIB`, plus a hard guarantee of the Discord 100-character limit:

```ts
import { CustomIdBuilder, CustomIdError } from "discordjs-components-v2";

const id = CustomIdBuilder.build({
  name: "_modal",       // autocomplete: "_selectmenu" | "_button" | "_modal" | string
  entityId: draft.id,   // "not"/undefined/"" → skipped (means "no entity")
  executorId,
  rest: ["p", "2"],     // need more data? a plain array of segments
});
// "_modal:x7k:555:p:2" — always ≤ 100 chars

const { name, entityId, executorId } = CustomIdBuilder.parse(id);
CustomIdBuilder.is(id, "_modal"); // true → fast routing without if/else

try {
  CustomIdBuilder.build({ name: "_button", entityId: "a:b" }); // ":" in a segment
} catch (e) {
  if (e instanceof CustomIdError) console.log(e.message); // CustomIdBuilder: …
}
```

| Method / Constant | Return |
|---|---|
| `.build(parts)` | assemble the id; throws `CustomIdError` on empty name, `:` inside a segment, or overflow >100 chars (with «shrink by N») |
| `.parse(customId)` | lenient split `{ name, entityId, executorId, rest, raw, length }`, never throws |
| `.is(customId, name)` | valid + name match (router-ready) |
| `.isValid(customId)` | true only if ≤100 chars and has a name |
| `.capacityOf(parts)` / `.remaining(parts)` | chars used / left before the limit |
| `CUSTOM_ID_MAX_LENGTH` | constant `100` |
| `CustomIdError` | dedicated error class |

Drop-in replacement for your `CIB`:

```ts
const CIB = CustomIdBuilder; // drop-in
```

## ✅ Validation

`build()` validates documented Discord limits (≤40 components total, ≤10 container children, ≤3 texts per section, 1–5 components per row, required button fields, etc.) and throws a readable error listing all problems. Standalone: `validateComponents(components)` → `{ valid, errors }`.

## 📄 License

MIT
