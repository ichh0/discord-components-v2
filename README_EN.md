# 📦 @discord-components/v2

> ⚡ **#VIBECODE** — This library was developed via neural network in a couple of hours for convenient work with Discord Components V2.

> A full-featured library for working with **Discord Components V2** (the new message format with components).  
> Built on `discord-api-types/v10` and compatible with `discord.js` (v14+).

---

## 📌 Table of Contents

1. [Installation](#-установка)
2. [What are Components V2](#-что-такое-components-v2)
3. [Quick Start](#-быстрый-старт)
4. [Core – Types and Utilities](#-core--типы-и-утилиты)
5. [Builders – Creating Components](#-builders--создание-компонентов)
   - [ButtonBuilder (button)](#buttonbuilder-кнопка)
   - [SelectMenuBuilder (dropdown)](#selectmenubuilder-выпадающий-список)
   - [ChannelSelectBuilder / RoleSelectBuilder / MentionableSelectBuilder / UserSelectBuilder](#каналы-роли-упоминания-пользователи)
   - [TextDisplayBuilder (text block)](#textdisplaybuilder-текстовый-блок)
   - [ContainerBuilder (container)](#containerbuilder-контейнер)
   - [SeparatorBuilder (separator)](#separatorbuilder-разделитель)
   - [ActionRowBuilder (action row)](#actionrowbuilder-ряд-действий)
   - [MessageBuilder (full message)](#messagebuilder-всё-сообщение)
   - [ComponentBuilder (factory)](#componentbuilder-фабрика)
6. [Managers – Search and Editing](#-managers--поиск-и-редактирование)
   - [BuilderManager](#buildermanager)
   - [ComponentSearcher](#componentsearcher)
7. [Utils – Helper Functions](#-utils--вспомогательные-функции)
8. [Validation](#-валидация)
9. [Full Example Scenario](#-пример-полного-сценария)
10. [Build and Publish](#-сборка-и-публикация)

---

## 📦 Installation

```bash
npm install @discord-components/v2
```

or

```bash
yarn add @discord-components/v2
```

**Peer dependency:** `discord-api-types` (version >= 0.37.83)

```bash
npm install discord-api-types
```

---

## 🧠 What are Components V2

Discord is gradually introducing a new component format (sometimes called **Message Components V2**).  
Instead of old `embeds` and `content`, you can now use:

- `TextDisplay` (type 10) – plain text with Markdown.
- `Container` (type 12) – a block with accent color, containing other components inside.
- `Separator` (type 14) – horizontal divider.
- Buttons (type 2) and all types of select menus (type 3, 5, 6, 7, 8) remain, but are embedded in the new hierarchy.

The main difference is the **`flags: 32768`** flag, which must be specified when sending.

Our library completely abstracts this complexity, providing a convenient **builder pattern**.

---

## 🚀 Quick Start

```typescript
import { ComponentBuilder } from "@discord-components/v2";

// Build the message
const message = ComponentBuilder.message()
  .addText("# Hello, world!")
  .addContainer(
    ComponentBuilder.container({ accentColor: 0x5865f2 })
      .addText("Inside the container")
      .addComponent(
        ComponentBuilder.button()
          .setLabel("Click me")
          .setStyle(1) // Primary
          .setCustomId("my_button"),
      ),
  )
  .addRow(
    ComponentBuilder.button()
      .setLabel("Cancel")
      .setStyle(4) // Danger
      .setCustomId("cancel"),
  )
  .build();

// Send via discord.js
await interaction.editReply({
  components: message.components,
  flags: message.flags,
});
```

---

## 🧩 Core – Types and Utilities

The library re‑exports all necessary types from `discord-api-types/v10` and adds its own:

- `AnyComponent` – union of all possible component types.
- `COMPONENTS_V2_FLAG` – constant `32768`.
- Type Guards: `isButton`, `isSelectMenu`, `isContainer`, `hasCustomId`, `hasContent`, etc.
- Factory `createEmptyComponent(type)` – creates an empty component of the given type.

These can be imported directly:

```typescript
import { AnyComponent, isButton, COMPONENTS_V2_FLAG } from "@discord-components/v2";
```

---

## 🛠️ Builders – Creating Components

### ButtonBuilder (button)

```typescript
const btn = ComponentBuilder.button()
  .setLabel("Click")
  .setStyle(ButtonStyle.Primary) // 1
  .setCustomId("click")
  .setEmoji({ name: "👍" })
  .setDisabled(false)
  .build();
```

**Methods:**

- `setStyle(style: ButtonStyle)`
- `setLabel(label: string)`
- `setCustomId(id: string)` – for interactive buttons.
- `setURL(url: string)` – for link buttons (style automatically set to `Link`).
- `setSKUId(skuId: string)` – for Premium buttons (style `Premium`).
- `setEmoji(emoji: { name?, id?, animated? })`
- `setDisabled(disabled: boolean)`

---

### SelectMenuBuilder (dropdown)

```typescript
const select = ComponentBuilder.selectMenu({ customId: "menu" })
  .setPlaceholder("Choose an option")
  .setMinValues(1)
  .setMaxValues(2)
  .addOption({ label: "Option 1", value: "1" })
  .addOption({ label: "Option 2", value: "2" })
  .build();
```

**Methods:**

- `setCustomId`, `setPlaceholder`, `setMinValues`, `setMaxValues`, `setDisabled`
- `addOption(option)`, `addOptions(...options)`, `setOptions(options)`

---

### Channels, Roles, Mentionables, Users

Similar to SelectMenu, but for specific types:

```typescript
const channelSelect = ComponentBuilder.channelSelect({ customId: "channels" })
  .setChannelTypes([0, 2]) // text and voice
  .build();

const roleSelect = ComponentBuilder.roleSelect({ customId: "roles" }).build();
const mentionableSelect = ComponentBuilder.mentionableSelect({ customId: "mentions" }).build();
const userSelect = ComponentBuilder.userSelect({ customId: "users" }).build();
```

---

### TextDisplayBuilder (text block)

```typescript
const text = ComponentBuilder.textDisplay({ content: "Plain text" }).setContent("New text").build();
```

Method: `setContent(content: string)`

---

### ContainerBuilder (container)

A container can hold any other components inside.

```typescript
const container = ComponentBuilder.container({ accentColor: 0x00ff00 })
  .addComponent(ComponentBuilder.textDisplay({ content: "Inside container" }))
  .addComponent(ComponentBuilder.button().setLabel("Inner button").setCustomId("inner"))
  .build();
```

**Methods:**

- `setAccentColor(color: number)`
- `addComponent(component)`, `addComponents(...components)`, `setComponents(components)`

---

### SeparatorBuilder (separator)

Simply a horizontal line.

```typescript
const sep = ComponentBuilder.separator().build();
```

---

### ActionRowBuilder (action row)

An Action Row can only contain interactive components (buttons and select menus), up to 5.

```typescript
const row = ComponentBuilder.actionRow().addComponent(btn1).addComponent(select).build();
```

**Methods:** `addComponent`, `addComponents`, `setComponents`.

---

### MessageBuilder (full message)

Builds root components (up to 10) and manages the V2 flag.

```typescript
const msg = ComponentBuilder.message()
  .addText("Header")
  .addContainer(container)
  .addRow(btn1, btn2)
  .addSeparator()
  .setFlags(0) // can add other flags
  .ensureV2Flag() // ensures flag 32768 is present
  .build();
```

**Methods:**

- `addComponent`, `addComponents`, `setComponents`
- `addRow(...items)` – automatically creates an ActionRow.
- `addText(content, spoiler?)` – creates a TextDisplay.
- `addContainer(container)`
- `addSeparator()`
- `setFlags(flags)`, `ensureV2Flag()`
- `build()` – returns `{ components, flags }`.

---

### ComponentBuilder (factory)

Static methods for creating any builder:

- `button(options?)`
- `actionRow()`
- `container(options?)`
- `selectMenu(options?)`
- `channelSelect(options?)`
- `roleSelect(options?)`
- `mentionableSelect(options?)`
- `userSelect(options?)`
- `textDisplay(options?)`
- `separator()`
- `message()`

---

## 🔍 Managers – Search and Editing

### BuilderManager

Allows editing existing components (e.g., fetched from `fetchReply`).

```typescript
import { BuilderManager } from "@discord-components/v2";

const reply = await interaction.fetchReply();
const manager = new BuilderManager(reply.components);

// Disable all buttons
manager.disableButtons();

// Change button label
manager.setButtonLabel("my_button", "New label");

// Replace text in all TextDisplays
manager.replaceText(/old/g, "new");

// Remove lines containing "start"
manager.removeLinesContaining("start");

// Get modified components
const newComponents = manager.toJSON();
await interaction.editReply({ components: newComponents, flags: 32768 });
```

**Main methods:**

- `search()` – returns a `ComponentSearcher`.
- `findByCustomId(customId)` – finds a component with this ID.
- `findAllByType(type)` – all components of the given type.
- `findByContent(search)` – searches text in `TextDisplay`.
- `setButtonLabel`, `setButtonStyle`, `setButtonDisabled`, `disableButtons`
- `replaceText(search, replacement)`
- `removeLinesContaining(search)`
- `removeLines(startIndex, count)`
- `toJSON()` – returns the final array.

### ComponentSearcher

Used internally by `BuilderManager`, but can be called separately:

```typescript
const searcher = new ComponentSearcher(components);
const result = searcher.findByCustomId("my_id");
if (result) {
  console.log(result.component, result.path);
}
```

**Methods:**

- `findByCustomId(customId)`
- `findAllByType(type)`
- `findByContent(search)`

All return `{ component, path: string[] }`, where `path` is an array of indices for access.

---

## 🧰 Utils – Helper Functions

### `cloneDeep(obj)`

Deep cloning (uses `structuredClone` if available).

### `mergeComponents(base, ...others)`

Merges multiple component arrays.

### `hasV2Flag(flags)`, `ensureV2Flag(flags)`

Check and set the `32768` flag.

### `parseEmoji(input)`

Parses an emoji string into `{ name?, id?, animated? }`. Supports:

- `😊` → `{ name: "😊" }`
- `:smile:` → `{ name: "smile" }`
- `<:name:123456789>` → `{ name: "name", id: "123456789" }`
- `<a:name:123456789>` → `{ name: "name", id: "123456789", animated: true }`

---

## ✅ Validation

Built‑in validation automatically checks:

- Maximum 10 root components.
- Total number of components (recursively) not exceeding 40.
- Each component contains required fields.
- Action Row contains no more than 5 elements and only interactive ones.
- Button has `custom_id`, `url`, or `sku_id`, and also `label` or `emoji`.

Validation is called on `build()` in `MessageBuilder`, but you can use it separately:

```typescript
import { validateComponents } from "@discord-components/v2";

const result = validateComponents(components);
if (!result.valid) {
  console.error(result.errors);
}
```

---

## 💡 Full Example Scenario (Giveaway)

```typescript
import { ComponentBuilder, BuilderManager } from "@discord-components/v2";

// --- Create the message ---
const message = ComponentBuilder.message()
  .addText("🎉 **Giveaway**")
  .addContainer(
    ComponentBuilder.container({ accentColor: 0xffa500 })
      .addText("Organizer: <@123456>")
      .addText("Prize: 100 coins"),
  )
  .addRow(
    ComponentBuilder.button().setLabel("Join").setCustomId("join").setStyle(3), // Success
    ComponentBuilder.button().setLabel("Close").setCustomId("close").setStyle(4), // Danger
  )
  .build();

// Send
const response = await interaction.editReply({ ...message, flags: message.flags });

// --- After 10 seconds ---
setTimeout(async () => {
  const reply = await interaction.fetchReply();
  const manager = new BuilderManager(reply.components);

  // 1. Remove the line "Prize: 100 coins"
  manager.removeLinesContaining("Prize: 100 coins");

  // 2. Change the "Join" button label to "Vote"
  manager.setButtonLabel("join", "Vote");

  // 3. Disable the "Close" button
  manager.setButtonDisabled("close", true);

  // 4. Add text "Giveaway ended!"
  const newMessage = ComponentBuilder.message().addText("Giveaway ended!").build();

  // But we can't just replace the message, so we update components:
  await interaction.editReply({
    components: manager.toJSON(),
    flags: 32768,
  });
}, 10000);
```

---

## 📄 License

MIT © (license)[license]

---

## 🙋 Support

If you find a bug or want to suggest an improvement, create an Issue on GitHub or a Pull Request.

---

**Good luck with Discord Components V2! 🚀**
