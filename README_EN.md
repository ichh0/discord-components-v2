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

## ✅ Validation

`build()` validates documented Discord limits (≤40 components total, ≤10 container children, ≤3 texts per section, 1–5 components per row, required button fields, etc.) and throws a readable error listing all problems. Standalone: `validateComponents(components)` → `{ valid, errors }`.

## 📄 License

MIT
