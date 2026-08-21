# 📦 @discord-components/v2

[🇬🇧 English version](README_EN.md)

> [!Caution]
>
> ### ВАЙБКОД
>
> Библиотека сделана с минимальным контролем кода и правками, создана потому что на рынке npm я до сих пор не увидел никаких альтернатив
> Не обязываю использовать эту бибилиотеку, буду рад вашим звёздам, форкам и [ишисами](https://github.com/ichh0/discord-components-v2/issues)

> Полнофункциональная библиотека для работы с **Discord Components V2** (новый формат сообщений с компонентами).  
> Построена на `discord-api-types/v10` и совместима с `discord.js` (v14+).

---

## 📌 Оглавление

1. [Установка](#-установка)
2. [Что такое Components V2](#-что-такое-components-v2)
3. [Быстрый старт](#-быстрый-старт)
4. [Core – типы и утилиты](#-core--типы-и-утилиты)
5. [Builders – создание компонентов](#-builders--создание-компонентов)
   - [ButtonBuilder (кнопка)](#buttonbuilder-кнопка)
   - [SelectMenuBuilder (выпадающий список)](#selectmenubuilder-выпадающий-список)
   - [ChannelSelectBuilder / RoleSelectBuilder / MentionableSelectBuilder / UserSelectBuilder](#каналы-роли-упоминания-пользователи)
   - [TextDisplayBuilder (текстовый блок)](#textdisplaybuilder-текстовый-блок)
   - [ContainerBuilder (контейнер)](#containerbuilder-контейнер)
   - [SeparatorBuilder (разделитель)](#separatorbuilder-разделитель)
   - [ActionRowBuilder (ряд действий)](#actionrowbuilder-ряд-действий)
   - [MessageBuilder (всё сообщение)](#messagebuilder-всё-сообщение)
   - [ComponentBuilder (фабрика)](#componentbuilder-фабрика)
6. [Managers – поиск и редактирование](#-managers--поиск-и-редактирование)
   - [BuilderManager](#buildermanager)
   - [ComponentSearcher](#componentsearcher)
7. [Utils – вспомогательные функции](#-utils--вспомогательные-функции)
8. [Валидация](#-валидация)
9. [Пример полного сценария](#-пример-полного-сценария)
10. [Сборка и публикация](#-сборка-и-публикация)

---

## 📦 Установка

```bash
npm install @discord-components/v2
```

или

```bash
yarn add @discord-components/v2
```

**Peer dependency:** `discord-api-types` (версия >= 0.37.83)

```bash
npm install discord-api-types
```

---

## 🧠 Что такое Components V2

Discord постепенно внедряет новый формат компонентов (иногда называют **Message Components V2**).  
Вместо старых `embeds` и `content` теперь можно использовать:

- `TextDisplay` (type 10) – обычный текст с Markdown.
- `Container` (type 12) – блок с акцентным цветом, внутри которого могут быть другие компоненты.
- `Separator` (type 14) – горизонтальный разделитель.
- Кнопки (type 2) и все виды селектов (type 3, 5, 6, 7, 8) остаются, но встраиваются в новую иерархию.

Главное отличие – **флаг `flags: 32768`**, который обязательно нужно указывать при отправке.

Наша библиотека полностью абстрагирует эту сложность, давая удобный **builder-паттерн**.

---

## 🚀 Быстрый старт

```typescript
import { ComponentBuilder } from "@discord-components/v2";

// Строим сообщение
const message = ComponentBuilder.message()
  .addText("# Привет, мир!")
  .addContainer(
    ComponentBuilder.container({ accentColor: 0x5865f2 })
      .addText("Это внутри контейнера")
      .addComponent(
        ComponentBuilder.button()
          .setLabel("Нажми меня")
          .setStyle(1) // Primary
          .setCustomId("my_button"),
      ),
  )
  .addRow(
    ComponentBuilder.button()
      .setLabel("Отмена")
      .setStyle(4) // Danger
      .setCustomId("cancel"),
  )
  .build();

// Отправка через discord.js
await interaction.editReply({
  components: message.components,
  flags: message.flags,
});
```

---

## 🧩 Core – типы и утилиты

Библиотека реэкспортирует все необходимые типы из `discord-api-types/v10` и добавляет свои:

- `AnyComponent` – объединение всех возможных типов компонентов.
- `COMPONENTS_V2_FLAG` – константа `32768`.
- Type Guards: `isButton`, `isSelectMenu`, `isContainer`, `hasCustomId`, `hasContent` и др.
- Фабрика `createEmptyComponent(type)` – создаёт заготовку компонента по типу.

Эти элементы импортируются напрямую:

```typescript
import { AnyComponent, isButton, COMPONENTS_V2_FLAG } from "@discord-components/v2";
```

---

## 🛠️ Builders – создание компонентов

### ButtonBuilder (кнопка)

```typescript
const btn = ComponentBuilder.button()
  .setLabel("Клик")
  .setStyle(ButtonStyle.Primary) // 1
  .setCustomId("click")
  .setEmoji({ name: "👍" })
  .setDisabled(false)
  .build();
```

**Методы:**

- `setStyle(style: ButtonStyle)`
- `setLabel(label: string)`
- `setCustomId(id: string)` – для интерактивных кнопок.
- `setURL(url: string)` – для ссылочных (стиль автоматически `Link`).
- `setSKUId(skuId: string)` – для Premium-кнопок (стиль `Premium`).
- `setEmoji(emoji: { name?, id?, animated? })`
- `setDisabled(disabled: boolean)`

---

### SelectMenuBuilder (выпадающий список)

```typescript
const select = ComponentBuilder.selectMenu({ customId: "menu" })
  .setPlaceholder("Выберите опцию")
  .setMinValues(1)
  .setMaxValues(2)
  .addOption({ label: "Опция 1", value: "1" })
  .addOption({ label: "Опция 2", value: "2" })
  .build();
```

**Методы:**

- `setCustomId`, `setPlaceholder`, `setMinValues`, `setMaxValues`, `setDisabled`
- `addOption(option)`, `addOptions(...options)`, `setOptions(options)`

---

### Каналы, роли, упоминания, пользователи

Аналогично SelectMenu, но для конкретных типов:

```typescript
const channelSelect = ComponentBuilder.channelSelect({ customId: "channels" })
  .setChannelTypes([0, 2]) // текстовые и голосовые
  .build();

const roleSelect = ComponentBuilder.roleSelect({ customId: "roles" }).build();
const mentionableSelect = ComponentBuilder.mentionableSelect({ customId: "mentions" }).build();
const userSelect = ComponentBuilder.userSelect({ customId: "users" }).build();
```

---

### TextDisplayBuilder (текстовый блок)

```typescript
const text = ComponentBuilder.textDisplay({ content: "Обычный текст" })
  .setContent("Новый текст")
  .build();
```

Метод: `setContent(content: string)`

---

### ContainerBuilder (контейнер)

Контейнер может содержать внутри любые другие компоненты.

```typescript
const container = ComponentBuilder.container({ accentColor: 0x00ff00 })
  .addComponent(ComponentBuilder.textDisplay({ content: "Внутри контейнера" }))
  .addComponent(ComponentBuilder.button().setLabel("Кнопка внутри").setCustomId("inner"))
  .build();
```

**Методы:**

- `setAccentColor(color: number)`
- `addComponent(component)`, `addComponents(...components)`, `setComponents(components)`

---

### SeparatorBuilder (разделитель)

Просто горизонтальная линия.

```typescript
const sep = ComponentBuilder.separator().build();
```

---

### ActionRowBuilder (ряд действий)

Action Row может содержать только интерактивные компоненты (кнопки и селекты), не более 5.

```typescript
const row = ComponentBuilder.actionRow().addComponent(btn1).addComponent(select).build();
```

**Методы:** `addComponent`, `addComponents`, `setComponents`.

---

### MessageBuilder (всё сообщение)

Собирает корневые компоненты (до 10 штук) и управляет флагом V2.

```typescript
const msg = ComponentBuilder.message()
  .addText("Заголовок")
  .addContainer(container)
  .addRow(btn1, btn2)
  .addSeparator()
  .setFlags(0) // можно добавить другие флаги
  .ensureV2Flag() // гарантирует наличие флага 32768
  .build();
```

**Методы:**

- `addComponent`, `addComponents`, `setComponents`
- `addRow(...items)` – автоматически создаёт ActionRow.
- `addText(content, spoiler?)` – создаёт TextDisplay.
- `addContainer(container)`
- `addSeparator()`
- `setFlags(flags)`, `ensureV2Flag()`
- `build()` – возвращает `{ components, flags }`.

---

### ComponentBuilder (фабрика)

Статические методы для создания любого билдера:

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

## 🔍 Managers – поиск и редактирование

### BuilderManager

Позволяет редактировать уже существующие компоненты (например, полученные из `fetchReply`).

```typescript
import { BuilderManager } from "@discord-components/v2";

const reply = await interaction.fetchReply();
const manager = new BuilderManager(reply.components);

// Отключаем все кнопки
manager.disableButtons();

// Меняем текст на кнопке
manager.setButtonLabel("my_button", "Новый текст");

// Заменяем текст во всех TextDisplay
manager.replaceText(/старый/g, "новый");

// Удаляем строки, содержащие "начало"
manager.removeLinesContaining("начало");

// Получаем изменённые компоненты
const newComponents = manager.toJSON();
await interaction.editReply({ components: newComponents, flags: 32768 });
```

**Основные методы:**

- `search()` – возвращает `ComponentSearcher`.
- `findByCustomId(customId)` – ищет компонент с этим ID.
- `findAllByType(type)` – все компоненты данного типа.
- `findByContent(search)` – поиск по тексту в `TextDisplay`.
- `setButtonLabel`, `setButtonStyle`, `setButtonDisabled`, `disableButtons`
- `replaceText(search, replacement)`
- `removeLinesContaining(search)`
- `removeLines(startIndex, count)`
- `toJSON()` – возвращает итоговый массив.

### ComponentSearcher

Используется внутри `BuilderManager`, но может быть вызван отдельно:

```typescript
const searcher = new ComponentSearcher(components);
const result = searcher.findByCustomId("my_id");
if (result) {
  console.log(result.component, result.path);
}
```

**Методы:**

- `findByCustomId(customId)`
- `findAllByType(type)`
- `findByContent(search)`

Все возвращают объект `{ component, path: string[] }`, где `path` – массив индексов для доступа.

---

## 🧰 Utils – вспомогательные функции

### `cloneDeep(obj)`

Глубокое клонирование (использует `structuredClone`, если доступно).

### `mergeComponents(base, ...others)`

Объединяет несколько массивов компонентов.

### `hasV2Flag(flags)`, `ensureV2Flag(flags)`

Проверка и установка флага `32768`.

### `parseEmoji(input)`

Парсит строку с эмодзи в объект `{ name?, id?, animated? }`. Поддерживает:

- `😊` → `{ name: "😊" }`
- `:smile:` → `{ name: "smile" }`
- `<:name:123456789>` → `{ name: "name", id: "123456789" }`
- `<a:name:123456789>` → `{ name: "name", id: "123456789", animated: true }`

---

## ✅ Валидация

Встроенная валидация автоматически проверяет:

- Максимум 10 корневых компонентов.
- Общее количество компонентов (рекурсивно) не более 40.
- Каждый компонент содержит обязательные поля.
- Action Row содержит не более 5 элементов и только интерактивные.
- Кнопка имеет `custom_id`, `url` или `sku_id`, а также `label` или `emoji`.

Валидация вызывается при `build()` у `MessageBuilder`, но вы можете использовать её отдельно:

```typescript
import { validateComponents } from "@discord-components/v2";

const result = validateComponents(components);
if (!result.valid) {
  console.error(result.errors);
}
```

---

## 💡 Пример полного сценария (розыгрыш)

```typescript
import { ComponentBuilder, BuilderManager } from "@discord-components/v2";

// --- Создание сообщения ---
const message = ComponentBuilder.message()
  .addText("🎉 **Розыгрыш**")
  .addContainer(
    ComponentBuilder.container({ accentColor: 0xffa500 })
      .addText("Организатор: <@123456>")
      .addText("Приз: 100 монет"),
  )
  .addRow(
    ComponentBuilder.button().setLabel("Участвовать").setCustomId("join").setStyle(3), // Success
    ComponentBuilder.button().setLabel("Закрыть").setCustomId("close").setStyle(4), // Danger
  )
  .build();

// Отправка
const response = await interaction.editReply({ ...message, flags: message.flags });

// --- Через 10 секунд ---
setTimeout(async () => {
  const reply = await interaction.fetchReply();
  const manager = new BuilderManager(reply.components);

  // 1. Удаляем строку "Приз: 100 монет"
  manager.removeLinesContaining("Приз: 100 монет");

  // 2. Меняем текст на кнопке "Участвовать" на "Голосовать"
  manager.setButtonLabel("join", "Голосовать");

  // 3. Отключаем кнопку "Закрыть"
  manager.setButtonDisabled("close", true);

  // 4. Добавляем текст "Розыгрыш окончен!"
  const newMessage = ComponentBuilder.message().addText("Розыгрыш окончен!").build();

  // Но мы не можем просто заменить сообщение, поэтому обновляем components:
  await interaction.editReply({
    components: manager.toJSON(),
    flags: 32768,
  });
}, 10000);
```

---

## 📄 Лицензия

MIT © (license)[license]

---

## 🙋 Поддержка

Если вы нашли ошибку или хотите предложить улучшение, создайте Issue на GitHub или Pull Request.

---

**Удачи с Discord Components V2! 🚀**
