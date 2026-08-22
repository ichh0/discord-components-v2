# 📦 discordjs-components-v2 v2

[![npm version](https://badge.fury.io/js/discordjs-components-v2.svg)](https://www.npmjs.com/package/discordjs-components-v2)
[![GitHub license](https://img.shields.io/github/license/ichh0/discord-components-v2)](https://github.com/ichh0/discord-components-v2/blob/main/license)

[🇬🇧 English](README_EN.md)

Библиотека для работы с **Discord Components V2**: сборщик (builder), разборщик (parser) и утилиты редактирования — **без кэшей**.

Ключевая идея: компоненты — это обычный JSON. Discord сам возвращает полное дерево компонентов в `message.components`, поэтому состояние сообщения можно **не хранить у себя**: забрал → разобрал → поправил → отправил.

> [!NOTE]
> Работает на чистых структурах `discord-api-types/v10`. discord.js не нужен ни в рантайме, ни как peer-зависимость — результат полностью совместим с discord.js v14 (передавайте JSON прямо в `components:`).

---

## 📦 Установка

```bash
npm install discordjs-components-v2 discord-api-types
```

## 🚀 Быстрый старт

```ts
import { V2Builder } from "discordjs-components-v2";

const payload = new V2Builder()
  .color(0xffaa00)
  .text("# 🎉 Розыгрыш")
  .field("Приз", "100 монет")
  .fields([
    { name: "Участников", value: "0" },
    { name: "До конца", value: "<t:1735689600:R>" },
  ])
  .buttons(
    { id: "join", label: "Участвовать", style: "Success", emoji: "🎟️" },
    { url: "https://example.com", label: "Правила" },
  )
  .selectMenu.string({
    customId: "category",
    placeholder: "Категория приза",
    options: [
      { label: "Игры", value: "games", emoji: "🎮" },
      { label: "Скины", value: "skins" },
    ],
  })
  .build(); // → { components, files?, flags: 32768 }

await interaction.reply(payload);
```

`build()` возвращает готовый payload: `{ content?, components, files?, flags }`. Можно раскидать вручную или вызвать `await builder.send(interaction, { ephemeral? })` — метод сам выберет `reply` / `editReply`.

---

## ♻️ Разборка без кэша (главная фича)

```ts
// где-то потом, хоть через неделю:
const message = await interaction.fetchReply();

const builder = parseComponents(message); // raw JSON → билдер

builder
  .replaceText("0 участников", "1 участник")
  .setButtonLabel("join", "Розыгрыш закрыт")
  .disableButtons(); // выключить все кнопки, включая кнопки-аксессуары секций

await builder.send(interaction); // editReply внутри
```

`parseComponents()` / `V2Builder.parse()` принимает:

| Вход | Пример |
|---|---|
| массив сырых компонентов | `[...message.components]` |
| message-like объект | `{ components: [...], content }` (fetched Message тоже ок) |
| одиночный компонент | `{ type: 17, components: [...] }` |
| что угодно с `.toJSON()` | discord.js билдеры и инстансы компонентов |

Если корневой компонент один и это контейнер — он поглощается целиком (цвет, spoiler, дети). Иначе всё оборачивается в неявный контейнер, чтобы fluent-API продолжало работать.

## 🔧 Утилиты редактирования

### `editComponents(data)` — цепочный редактор над «сырыми» компонентами

```ts
import { editComponents } from "discordjs-components-v2";

const components = editComponents(await interaction.fetchReply())
  .disableButtons()              // выключить все кнопки
  .enableButtons("open")         // …кроме одной
  .removeButtons("rules")        // кнопку rules — удалить вообще
  .remove("pick")                // убрать любой компонент по customId
  .keepOnly(/розыгрыш/i)         // оставить только совпавшее (+ предков)
  .setButtonLabel("join", "Голосовать")
  .replaceText("100 монет", "200 монет")
  .toJSON();

await interaction.editReply({ components, flags: 32768 });
```

Входные данные никогда не мутируются — редактор работает на глубокой копии.

Принимаются и целые объекты сообщения (`await ctx.fetchReply()`, инстанс discord.js `Message`, их `toJSON()`), в том числе обёрнутые в массив: сообщение распознаётся по типу (0/19/20/… — не компонентный) и разворачивается до его `components`. Сообщение без компонентов даёт пустой массив; мусорные записи без валидного `type` отбрасываются. Флаги сообщения при этом не переносятся — см. ниже.

> ⚠️ **При редактировании CV2-сообщения сохраняйте флаг `IS_COMPONENTS_V2` (32768).** Без него Discord отвергнет контейнеры с той же ошибкой `UNION_TYPE_CHOICES`. Удобно брать флаги из полученного сообщения:
>
> ```ts
> const fetched = await ctx.fetchReply();
> await ctx.editReply({
>   components: editComponents(fetched).disableButtons().toJSON(),
>   flags: fetched.flags, // уже содержит IS_COMPONENTS_V2
> });
> ```

Автоматическая чистка после удалений: пустые ActionRow удаляются, секция без текста/аксессуара удаляется целиком (Discord такое не принимает).

### Селекторы

Везде, где нужен поиск/удаление, используется единый селектор:

- `"my_id"` — точное совпадение `custom_id`
- `ComponentType.Button` — точный тип
- `/regex/i` — проверяется по `custom_id`, label и тексту TextDisplay
- `(c) => boolean` — свой предикат

### Поиск и извлечение информации

```ts
builder.find("join");            // ComponentRef | null — нода + путь + родитель
builder.findAll(ComponentType.TextDisplay);
builder.getTexts();              // содержимое всех текстовых блоков

findComponents(rawArray, selector); // standalone-версия
```

## 🧱 Методы билдера

| Метод | Что делает |
|---|---|
| `.text(md)` | TextDisplay с markdown |
| `.content(str)` | plain-контент над компонентами |
| `.field(name, value, inline?)` | пара «имя — значение» |
| `.fields([...])` | выровненная двухколоночная таблица в ```ansi``` |
| `.buttons(...)` | ряд из ≤5 кнопок (`id`/`url`/`skuId`, style строкой: `"Primary"`…) |
| `.selectMenu.string/user/role/mentionable/channel(params)` | селект отдельным рядом |
| `.section({ title, content?, thumbnailUrl?, button?, spoiler? })` | Section с thumbnail или кнопкой |
| `.gallery(urls \| items)` | MediaGallery до 10 картинок |
| `.media(buffer, name?)` | attachment + галерея `attachment://…` |
| `.file(bufferOrPayload, name?, spoiler?)` | File-компонент |
| `.separator(size?, divider?)` | разделитель |
| `.color(hex)` / `.spoiler(bool)` | акцент/spoiler контейнера |
| `.setId(n)` | числовой id контейнера |
| `.clear()` / `.getAttachments()` | сброс состояния / файлы |

Методы редактирования доступны прямо на билдере: `disableButtons`, `enableButtons`, `setDisabled`, `setButtonLabel`, `remove`, `removeButtons`, `keepOnly`, `replaceText`, `find`, `findAll`, `getTexts`.

## ✅ Валидация

`build()` проверяет документированные лимиты Discord (≤40 компонентов всего, ≤10 детей контейнера, ≤3 текстов в секции, 1–5 компонентов в ряду, обязательные поля кнопок и т.д.) и кидает понятную ошибку со списком проблем. Отдельно: `validateComponents(components)` → `{ valid, errors }`.

## 📄 Лицензия

MIT
