# 📦 discordjs-components-v2 v2

[![npm version](https://badge.fury.io/js/discordjs-components-v2.svg)](https://www.npmjs.com/package/discordjs-components-v2)
[![GitHub license](https://img.shields.io/github/license/ichh0/discord-components-v2)](https://github.com/ichh0/discord-components-v2/blob/main/license)

[🇷🇺 Русский](README.md)

A library for **Discord Components V2**: a builder, a parser and editing utilities — **cache-free**.

The core idea: components are plain JSON. Discord itself returns the full component tree in `message.components`, so you don't need to store message state anywhere: fetch → parse → edit → send.

> [!NOTE]
> Built on plain `discord-api-types/v10` structures. discord.js is not required at runtime nor as a peer dependency — the output is fully compatible with discord.js v14 (pass JSON straight into `components:`).

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

Editing methods are available right on the builder: `disableButtons`, `enableButtons`, `setDisabled`, `setButtonLabel`, `remove`, `removeButtons`, `keepOnly`, `replaceText`, `find`, `findAll`, `getTexts`.

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

## ✅ Validation

`build()` validates documented Discord limits (≤40 components total, ≤10 container children, ≤3 texts per section, 1–5 components per row, required button fields, etc.) and throws a readable error listing all problems. Standalone: `validateComponents(components)` → `{ valid, errors }`.

## 📄 License

MIT
