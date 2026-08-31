# 📦 discordjs-components-v2 v2

[![npm version](https://badge.fury.io/js/discordjs-components-v2.svg)](https://www.npmjs.com/package/discordjs-components-v2)
[![GitHub license](https://img.shields.io/github/license/ichh0/discord-components-v2)](https://github.com/ichh0/discord-components-v2/blob/main/license)

[🇬🇧 English](README_EN.md)

Библиотека для работы с **Discord Components V2**: сборщик (builder), разборщик (parser) и утилиты редактирования — **без кэшей**.

Ключевая идея: компоненты — это обычный JSON. Discord сам возвращает полное дерево компонентов в `message.components`, поэтому состояние сообщения можно **не хранить у себя**: забрал → разобрал → поправил → отправил.

> [!NOTE]
> Работает на чистых структурах `discord-api-types/v10`. discord.js не нужен ни в рантайме, ни как peer-зависимость — результат полностью совместим с discord.js v14 (передавайте JSON прямо в `components:`).

### ✨ Возможности

- **`V2Builder`** — декларативная сборка компонентов: текст, кнопки, селекты, секции, разделители, галереи, вложения, ANSI-таблицы.
- **Кэш-фри разбор** — `parseComponents()` / `V2Builder.parse()` превращают `message.components` обратно в билдер.
- **Утилиты редактирования** — `editComponents()` / `ComponentsEditor`: удалить, заменить, переместить, отключить кнопки, переписать текст/секции/галереи.
- **Модальные окна V2** — `V2ModalBuilder`: плоские описания полей + мутация после добавления, типизированный разбор сабмита (`parseSubmit`), `.from()`, валидация и `rule()`.
- **Состояние в `customId`** — `CustomIdBuilder`: кодек `name:entityId:executorId` с гарантией ≤100 символов.
- **Валидация** — `validateComponents()` / `build()` ловят лимиты Discord до отправки.

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
  .remove("textDisplay", 1)      // убрать 2-й текстовый блок по kind-индексу
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

### Селект-меню: удаление, сброс и правка

`removeSelectMenus({ type, customIds })` удаляет селекты по виду и/или по `custom_id` (пустые ряды чистятся автоматически), `clearSelectValues(...)` обнуляет ранее выбранное значение — чтобы тот же селект можно было вызвать заново:

```ts
editComponents(await interaction.fetchReply())
  .removeSelectMenus({ type: "string" })          // убрать все строковые селекты
  .removeSelectMenus({ type: ["role", "user"], customIds: "filter" })
  .clearSelectValues({ type: "mentionable" })     // сбросить выбранное (default_values / default)
  .getSelectMenus({ type: "user" })               // найти селекты (массив с raw-компонентами)
  .findSelectMenu({ customIds: "pick" })          // первый подходящий или null
  .setSelectPlaceholder("pick", "Выбери")         // placeholder (undefined — убрать)
  .setSelectOptions("pick", [                     // заменить опции строкового селекта
    { label: "X", value: "x", emoji: ":fire:" },
    { label: "Y", value: "y", default: true },
  ])
  .setSelectMinMaxValues("pick", 1, 3)            // min/max (undefined — убрать)
  .setSelectDisabled({ type: "role" })            // disabled (false — включить обратно)
  .replaceSelectMenu({ customIds: "roles" }, { type: 2, style: 1, label: "Go", custom_id: "go" })
  .toJSON();
```

Кнопки: `setButtonStyle(customId, style)` (при переходе в Link убирает `custom_id`, при выходе — `url`), `setButtonEmoji(customId, emoji?)` (та же строка, что в `parseEmoji`; `undefined` — убрать), `setButtonUrl(customId, url?)` (превращает кнопку в Link; `undefined` — убрать), `renameCustomId(from, to)` (переименовывает `custom_id` везде, бросает ошибку, если ничего не нашлось).

Всё доступно и на `V2Builder`/`parseComponents`, и как standalone-функции. `type`: `"string" | "user" | "role" | "channel" | "mentionable"` (можно массив); фильтр по `customIds` — строкой или массивом.

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

Методы редактирования доступны прямо на билдере: `disableButtons`, `enableButtons`, `setDisabled`, `setButtonLabel`, `setButtonStyle`, `setButtonEmoji`, `setButtonUrl`, `remove`, `removeButtons`, `removeSelectMenus`, `clearSelectValues`, `setSelectPlaceholder`, `setSelectOptions`, `setSelectMinMaxValues`, `setSelectDisabled`, `getSelectMenus`, `findSelectMenu`, `replaceSelectMenu`, `renameCustomId`, `replaceText`, `find`, `findAll`, `getTexts`.

## 📝 Модальные окна (`V2ModalBuilder`)

Упрощённая обёртка над модальным API Components V2 — вместо ручного жонглирования `LabelBuilder` + внутренними билдерами опишите форму плоскими объектами. Каждое интерактивное поле автоматически оборачивается в `LabelBuilder`.

```ts
import { V2ModalBuilder } from "discordjs-components-v2";

const modal = new V2ModalBuilder()
  .setTitle("Создание набора")
  .setCustomId(`createNabor_modal:${executorId}`)
  .textInput({
    label: "Название набора",
    customId: "name_nabor",
    minLength: 3,
    maxLength: 15,
    placeholder: "например: Модератор",
    required: true,
  })
  .roleSelect({ label: "Выберите роль", customId: "give_role", required: true })
  .channelSelect({ label: "Канал публикации", customId: "publish_channel", maxValues: 1, minValues: 1, channelTypes: [0] })
  .radioGroup({
    label: "Тип ввода",
    customId: "type_input",
    options: [
      { label: "Однострочный", value: "short", description: "Одна строка" },
      { label: "Многострочный", value: "long", description: "Одна и более" },
    ],
  })
  .build();

await interaction.showModal(modal);
```

Поля: `.textInput(...)` (style `"short"`/`"paragraph"`, `value` — префилл), `.roleSelect(...)`, `.channelSelect(...)`, `.userSelect(...)`, `.mentionableSelect(...)`, `.stringSelect(...)` (эмодзи строкой: `"👍"`, `":name:"`, `"<:name:id>"`), `.radioGroup(...)`, плюс `.setTitle()` / `.setCustomId()` / `.build()`. Передавать `value: undefined` безопасно — значение просто не ставится.

### Изменение полей после добавления

Значение часто известно только после проверок (например, при редактировании вопроса). Каждое добавленное поле доступно по его `customId` как живой discord.js-билдер — мутации отражаются в уже собранной модалке:

```ts
const v2Modal = new V2ModalBuilder({ customId, title })
  .textInput({ label: "Укажите текст вопроса", customId: "question", minLength: 5, maxLength: 45 })
  .textInput({ label: "Подсказка", customId: "placeholder", style: "paragraph" })
  .radioGroup({ label: "Тип ввода", customId: "type_input", options });

if (isUpdate) v2Modal.setTextInputValue("question", questionData.label);

const input = v2Modal.component("placeholder"); // живой TextInputBuilder
input.setPlaceholder("новый placeholder");        // мутируем напрямую
input.setRequired(true);

await ctx.showModal(v2Modal.build());
```

| Метод | Что даёт |
|---|---|
| `.component(customId)` | живой билдер поля (`TextInputBuilder` / селект / `RadioGroupBuilder`) или `undefined` |
| `.textInputComponent(customId)` | `TextInputBuilder \| undefined` — только текстовые поля |
| `.setTextInputValue(customId, value)` | цепляющийся сеттер значения (`this`), кидает при неизвестном `customId` или не-текстовом поле |
| `.inner` | лежащий в основе discord.js `ModalBuilder` (редко нужно) |

Через возвращённый билдер мутируется всё: `.setValue()`, `.setRequired()`, `.setPlaceholder()`, `.setOptions()`, `.setDefaultRoles()` и т.д.

Сеттеры по умолчанию для селектов и радио (дефолты можно менять даже после добавления поля):

| Метод | Что делает |
|---|---|
| `.setRadioGroupDefault(customId, value)` | отметить вариант радио (кидает, если такого варианта нет) |
| `.setStringSelectDefaults(customId, values[])` | отметить значения мультиселекта |
| `.setRoleSelectDefaults(customId, roleIds[])` | дефолтные роли |
| `.setChannelSelectDefaults(customId, channelIds[])` | дефолтные каналы |
| `.setUserSelectDefaults(customId, userIds[])` | дефолтные пользователи |
| `.setMentionableSelectDefaults(customId, defaults[])` | дефолты для mentionable: `{ id, type: "user" \| "role" }[]` |

Пример:

```ts
const modal = new V2ModalBuilder({ title: "Фильтр", customId: "filter" })
  .stringSelect({ label: "Каналы", customId: "chs", options })
  .radioGroup({ label: "Направление", customId: "dir", options: dirOptions });

if (savedFilter) {
  modal.setStringSelectDefaults("chs", savedFilter.channels);
  modal.setRadioGroupDefault("dir", savedFilter.direction);
}
```

### Разбор сабмита

`parseSubmit()` читает значения по `customId` прямо из интеракции в типизированный объект — без ручных кастов и `getTextInputValue()` по одному:

```ts
const query = modal.parseSubmit(interaction); // ModalSubmitInteraction

query.name_nabor;      // string — textInput
query.type_input;      // string | null — radio
query.give_role;       // string[] | null — отмеченные id ролей (или users/channels/mentionables)
query.publish_channel; // string[] | null
```

Состав автоматически берётся из добавленных полей; получить его отдельно можно через `.getSchema()` — массив `{ customId, kind }` (`"text_input" | "radio_group" | "string_select" | "role_select" | "channel_select" | "user_select" | "mentionable_select"`). Для полей вне билдера есть standalone-функция `parseModalSubmit(interaction, schema)`.

### Восстановление из JSON

`.from()` пересобирает модалку из JSON/дискордовского `ModalBuilder` — удобно при миграции старого кода (обычные `ActionRow` + `TextInput`) или хранения пресетов:

```ts
const rebuilt = V2ModalBuilder.from(savedModalJson).build();
```

### Валидация и `show()`

`build()` проверяет форму перед сборкой и кидает `Error` с описанием всех проблем: отсутствие `title`/`custom_id`, дубликаты `customId`, `minLength > maxLength`, `minValues > maxValues`, а также ошибки пользовательских правил:

```ts
const modal = new V2ModalBuilder({ title: "Диапазон", customId: "range" })
  .textInput({ label: "min", customId: "min_values" })
  .textInput({ label: "max", customId: "max_values" })
  .rule((b) => {
    const min = Number(b.textInputComponent("min_values")?.data.value);
    const max = Number(b.textInputComponent("max_values")?.data.value);
    return Number.isFinite(min) && Number.isFinite(max) && min > max
      ? "min не может быть больше max"
      : null;
  });

modal.setTextInputValue("min_values", "10").setTextInputValue("max_values", "5");
modal.build(); // throws — правило вернуло текст ошибки
```

Метод `.validate()` возвращает массив строк-проблем (пустой — всё ок), а `.show(target)` сразу показывает модалку:

```ts
await newsV2Modal.show(interaction); // eqv. interaction.showModal(newsV2Modal.build())
```

## 🧩 Управление секциями и layout-компонентами

`V2Builder` и `ComponentsEditor` позволяют гибко управлять компонентами внутри контейнера по их индексу: секциями (`Section`), разделителями (`Separator`), текстовыми блоками (`TextDisplay`), галереями (`MediaGallery`) и рядами (`ActionRow`). Каждый тип индексируется отдельно (считаются только компоненты своего типа) — общий механизм для всех видов называется «kind» (`"section" | "separator" | "textDisplay" | "actionRow" | "mediaGallery"`), можно удалить, заменить или переставить любой из них.

| Метод | Описание |
|---|---|
| `.all(kind)` · `.get(kind, i)` | список / один `{ index, component, containerIndex }` |
| `.remove(kind, i)` · `.replace({ kind, index }, r)` | удалить / заменить по kind-индексу |
| `.move(kind, from, to)` | переместить (move также в `lib/advanced`) |
| `.sections` / `.separators` / `.textDisplays` / `.actionRows` / `.mediaGalleries` | namespace: `.all()`, `.get(i)`, `.set(i, v)`, `.remove(i)`, `.move(a, b)` |

Все *remove/replace/move/set* методы возвращают `this` для чейнинга. `set` для `textDisplay` принимает строку: `builder.textDisplays.set(2, "новый текст")`.

```ts
const builder = V2Builder.parse(message);

// Сколько секций в компоненте?
const sections = builder.all("section"); // [{ index: 0, component, containerIndex: 2 }, ...]

// Удалить второй разделитель
builder.remove("separator", 1);
// то же самое:
builder.separators.remove(1);

// Убрать все разделители между секциями
while (builder.all("separator").length) builder.remove("separator", 0);

// Удалить один текстовый блок
builder.remove("textDisplay", 0);

// Заменить первую секцию целиком
builder.replace({ kind: "section", index: 0 }, {
  type: ComponentType.Section,
  components: [{ type: ComponentType.TextDisplay, content: "**Новый заголовок**\nНовый контент" }],
  accessory: { type: ComponentType.Thumbnail, media: { url: "https://example.com/img.png" } },
});

// Переместить последнюю секцию наверх
builder.move("section", 2, 0);

// Чейнинг: убрать одну секцию и переставить оставшиеся
builder.remove("section", 1).move("section", 0, 1);

await builder.send(interaction);
```

Те же операции доступны через `ComponentsEditor`:

```ts
editComponents(message)
  .remove("separator", 1)
  .remove("textDisplay", 0)
  .all("section");
```

А также как standalone-функции над сырым массивом детей контейнера (`getAllByKind`, `getByKind`, `removeByKind`, `replaceByKind` из корня; `moveByKind` — из `lib/advanced`) — автоматом раскрывают корневой контейнер:

```ts
import { getAllByKind, removeByKind } from "discordjs-components-v2";
import { moveByKind } from "discordjs-components-v2/lib/advanced";

const seps = getAllByKind(container.components, "separator"); // [{ index, component, containerIndex }]
removeByKind(container.components, "separator", 1);
moveByKind(container.components, "separator", 2, 0);
```

Редкие цельнодеревые операции вынесены в `discordjs-components-v2/lib/advanced`:

```ts
import { keepOnly } from "discordjs-components-v2/lib/advanced";

keepOnly(container.components, /розыгрыш/i); // оставить только совпавшее (+ предков), in place
```

## 🏗️ Шаблоны и пагинация (`V2Template` / `V2Paginator`)

`V2Template` собирает каркас сообщения один раз и рендерит его с любыми значениями — без кэшей. Слоты регистрируются с сентинелом (авто: `slot("x")` → `{{x}}`), `render()` подставляет значения в каждый TextDisplay и в обычный `content`:

```ts
import { V2Builder } from "discordjs-components-v2";
import { V2Template } from "discordjs-components-v2/lib/template";

const tpl = new V2Template(new V2Builder().text("Привет, {{name}}!"));
tpl.slot("name"); // сентинел {{name}}

const payload = tpl.render({ name: "Мир" }).build(); // "Привет, Мир!"
```

`V2Paginator` — бесстейтовая пагинация поверх шаблона: страницы это slot-мапы (или готовые шаблоны), вниз добавляется ряд кнопок `pag:0`/`pag:1`/… (текущая выделена и задизаблена). Текущая страница всегда читается из самого сообщения, поэтому состояние не хранится:

```ts
import { V2Builder } from "discordjs-components-v2";
import { V2Template } from "discordjs-components-v2/lib/template";
import { V2Paginator } from "discordjs-components-v2/lib/pagination";

const tpl = new V2Template(new V2Builder().text("{{content}}")).slot("content");
const pages = new V2Paginator({
  template: tpl,
  pages: [{ content: "Страница 1" }, { content: "Страница 2" }],
  pageButton: "pag",
});

// в обработчике кнопок pag:N / pag:prev / pag:next:
if (await pages.jump(ctx)) return; // сам делает update()/editReply()/reply()
```

## 🆔 Хранение состояния в `customId` (`CustomIdBuilder`)

Компоненты без кэша = состояние живёт в самом `custom_id`. Однострочный кодек формата `name:entityId:executorId:rest…` (разделитель всегда `:`) с теми же правилами, что и классический `CIB`, но с гарантией лимита Discord в 100 символов:

```ts
import { CustomIdBuilder, CustomIdError } from "discordjs-components-v2";

const id = CustomIdBuilder.build({
  name: "_modal",       // autocomplete: "_selectmenu" | "_button" | "_modal" | string
  entityId: draft.id,   // "not"/undefined/"" → пропускается (как «нет сущности»)
  executorId,
  rest: ["p", "2"],     // если нужно больше данных — простой массив сегментов
});
// "_modal:x7k:555:p:2" — всегда ≤ 100 символов

const { name, entityId, executorId } = CustomIdBuilder.parse(id);
CustomIdBuilder.is(id, "_modal"); // true → быстрый роутинг без if/else

try {
  CustomIdBuilder.build({ name: "_button", entityId: "a:b" }); // ":" в сегменте
} catch (e) {
  if (e instanceof CustomIdError) console.log(e.message); // CustomIdBuilder: …
}
```

| Метод/Константа | Что даёт |
|---|---|
| `.build(parts)` | собрать id, кинуть `CustomIdError` при пустом имени, `:` внутри сегмента или переполнении >100 символов (с числом «сократить на N») |
| `.parse(customId)` | lenient-разбор `{ name, entityId, executorId, rest, raw, length }`, никогда не падает |
| `.is(customId, name)` | валидность + совпадение имени (готово для роутера) |
| `.isValid(customId)` | true только если до 100 символов и есть имя |
| `.capacityOf(parts)` / `.remaining(parts)` | занято / свободно символов до лимита |
| `CUSTOM_ID_MAX_LENGTH` | константа `100` |
| `CustomIdError` | отдельный класс ошибок |

Замена вашего `CIB` — тот же API:

```ts
const CIB = CustomIdBuilder; // drop-in
```

## ✅ Валидация

`build()` проверяет документированные лимиты Discord (≤40 компонентов всего, ≤10 детей контейнера, ≤3 текстов в секции, 1–5 компонентов в ряду, обязательные поля кнопок и т.д.) и кидает понятную ошибку со списком проблем. Отдельно: `validateComponents(components)` → `{ valid, errors }`.

## 📄 Лицензия

MIT
