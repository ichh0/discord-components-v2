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

## 🧩 Управление секциями

`V2Builder` и `ComponentsEditor` позволяют гибко управлять секциями (`Section`) внутри контейнера по их индексу. Это удобно, когда в одном компоненте несколько секций, разделённых сепараторами: можно удалить, заменить или переставить любую из них.

| Метод | Описание |
|---|---|
| `.getSections()` | список всех секций: `SectionRef[]` (`{ index, component, containerIndex }`) |
| `.getSection(index)` | одна секция по индексу или `null` |
| `.removeSection(index)` | удалить секцию по индексу (возвращает `this` для чейнинга) |
| `.replaceSection(index, replacement)` | заменить секцию на новую in-place |
| `.moveSection(from, to)` | переместить секцию из одной позиции в другую |

```ts
const builder = V2Builder.parse(message);

// Сколько секций в компоненте?
const sections = builder.getSections(); // [{ index: 0, component, containerIndex: 2 }, ...]

// Удалить вторую секцию
builder.removeSection(1);

// Заменить первую секцию целиком
builder.replaceSection(0, {
  type: ComponentType.Section,
  components: [{ type: ComponentType.TextDisplay, content: "**Новый заголовок**\nНовый контент" }],
  accessory: { type: ComponentType.Thumbnail, media: { url: "https://example.com/img.png" } },
});

// Переместить последнюю секцию наверх
builder.moveSection(2, 0);

// Чейнинг: убрать одну секцию и переставить оставшиеся
builder.removeSection(1).moveSection(0, 1);

await builder.send(interaction);
```

Те же операции доступны через `ComponentsEditor`:

```ts
editComponents(message)
  .removeSection(0)
  .getSections();
```

А также как standalone-функции над сырым массивом детей контейнера (`getSections`, `getSection`, `removeSection`, `replaceSection`, `moveSection`) — автоматом раскрывают корневой контейнер:

```ts
import { getSections, removeSection, moveSection } from "discordjs-components-v2";

const sections = getSections(container.components); // [SectionRef]
removeSection(container.components, 1);
moveSection(container.components, 2, 0);
```

## ✅ Валидация

`build()` проверяет документированные лимиты Discord (≤40 компонентов всего, ≤10 детей контейнера, ≤3 текстов в секции, 1–5 компонентов в ряду, обязательные поля кнопок и т.д.) и кидает понятную ошибку со списком проблем. Отдельно: `validateComponents(components)` → `{ valid, errors }`.

## 📄 Лицензия

MIT
