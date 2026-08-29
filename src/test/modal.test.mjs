import assert from "node:assert/strict";
import test from "node:test";

import { ComponentType, ModalBuilder } from "discord.js";
import { V2ModalBuilder } from "../../dist/index.js";

function json(modal) {
  return modal.toJSON();
}

test("modal: minimal build returns a discord.js ModalBuilder", () => {
  const builder = new V2ModalBuilder({ title: "Тест", customId: "test_modal" });
  const modal = builder.build();
  assert.ok(modal instanceof ModalBuilder);
  assert.equal(builder.inner.data.title, "Тест");
  assert.equal(builder.inner.data.custom_id, "test_modal");
});

test("modal: labels can be added via chainable setTitle/setCustomId", () => {
  const data = json(
    new V2ModalBuilder()
      .setTitle("Заголовок")
      .setCustomId("x:1")
      .textInput({ label: "Q", customId: "q" })
      .build(),
  );
  assert.equal(data.title, "Заголовок");
  assert.equal(data.custom_id, "x:1");
});

test("modal: textInput wraps value in a Label with a TextInput child", () => {
  const data = json(
    new V2ModalBuilder()
      .setCustomId("m")
      .setTitle("M")
      .textInput({
        label: "Название",
        customId: "name",
        minLength: 3,
        maxLength: 15,
        placeholder: "например: Модератор",
        required: true,
        style: "short",
      })
      .build(),
  );

  assert.equal(data.components.length, 1);
  const label = data.components[0];
  assert.equal(label.type, ComponentType.Label);
  assert.equal(label.label, "Название");
  assert.equal(label.component.type, ComponentType.TextInput);
  assert.equal(label.component.custom_id, "name");
  assert.equal(label.component.style, 1); // Short
  assert.equal(label.component.required, true);
  assert.equal(label.component.min_length, 3);
  assert.equal(label.component.max_length, 15);
  assert.equal(label.component.placeholder, "например: Модератор");
});

test("modal: textInput placeholder default style is Short and optional by default", () => {
  const label = json(
    new V2ModalBuilder().setCustomId("m").setTitle("M").textInput({ label: "Q", customId: "q" }).build(),
  ).components[0];
  assert.equal(label.component.style, 1); // Short
  assert.equal(label.component.required, false);
});

test("modal: textInput supports paragraph style and value prefill", () => {
  const label = json(
    new V2ModalBuilder().setCustomId("m").setTitle("M").textInput({
      label: "Описание",
      customId: "desc",
      style: "paragraph",
      value: "префилл",
    }).build(),
  ).components[0];
  assert.equal(label.component.style, 2); // Paragraph
  assert.equal(label.component.value, "префилл");
});

test("modal: roleSelect produces a labelled RoleSelectMenu", () => {
  const label = json(
    new V2ModalBuilder().setCustomId("m").setTitle("M")
      .roleSelect({
        label: "Роль",
        customId: "give_role",
        required: true,
        minValues: 1,
        maxValues: 1,
        roleIds: ["111", "222"],
      })
      .build(),
  ).components[0];

  assert.equal(label.type, ComponentType.Label);
  assert.equal(label.label, "Роль");
  assert.equal(label.component.type, ComponentType.RoleSelect);
  assert.equal(label.component.custom_id, "give_role");
  assert.equal(label.component.required, true);
  assert.equal(label.component.min_values, 1);
  assert.equal(label.component.max_values, 1);
  assert.deepEqual(label.component.default_values.map((v) => v.id), ["111", "222"]);
});

test("modal: channelSelect restricts channel types", () => {
  const label = json(
    new V2ModalBuilder().setCustomId("m").setTitle("M")
      .channelSelect({
        label: "Канал",
        customId: "publish_channel",
        channelTypes: [0], // GuildText
      })
      .build(),
  ).components[0];

  assert.equal(label.component.type, ComponentType.ChannelSelect);
  assert.deepEqual(label.component.channel_types, [0]);
});

test("modal: userSelect presets user ids", () => {
  const label = json(
    new V2ModalBuilder().setCustomId("m").setTitle("M")
      .userSelect({ label: "Юзер", customId: "u", userIds: ["333"] })
      .build(),
  ).components[0];
  assert.equal(label.component.type, ComponentType.UserSelect);
  assert.deepEqual(label.component.default_values.map((v) => v.id), ["333"]);
});

test("modal: mentionableSelect produces a labelled MentionableSelectMenu", () => {
  const label = json(
    new V2ModalBuilder().setCustomId("m").setTitle("M")
      .mentionableSelect({ label: "Упомянуть", customId: "men" })
      .build(),
  ).components[0];
  assert.equal(label.component.type, ComponentType.MentionableSelect);
});

test("modal: stringSelect maps options incl. friendly emoji", () => {
  const label = json(
    new V2ModalBuilder().setCustomId("m").setTitle("M")
      .stringSelect({
        label: "Вариант",
        customId: "pick",
        options: [
          { label: "Один", value: "1", default: true, emoji: "👍" },
          { label: "Два", value: "2", emoji: "<:sky:123>" },
          { label: "Три", value: "3", emoji: "<a:anim:456>" },
        ],
      })
      .build(),
  ).components[0];

  assert.equal(label.component.type, ComponentType.StringSelect);
  const opts = label.component.options;
  assert.equal(opts[0].default, true);
  assert.deepEqual(opts[0].emoji, { name: "👍" });
  assert.deepEqual(opts[1].emoji, { name: "sky", id: "123", animated: false });
  assert.deepEqual(opts[2].emoji, { name: "anim", id: "456", animated: true });
});

test("modal: radioGroup wraps options in a RadioGroup child", () => {
  const label = json(
    new V2ModalBuilder().setCustomId("m").setTitle("M")
      .radioGroup({
        label: "Тип ввода",
        customId: "type_input",
        required: true,
        options: [
          { label: "Однострочный", value: "short", default: true, description: "Одна строка" },
          { label: "Многострочный", value: "long" },
        ],
      })
      .build(),
  ).components[0];

  assert.equal(label.type, ComponentType.Label);
  assert.equal(label.component.type, ComponentType.RadioGroup);
  assert.equal(label.component.custom_id, "type_input");
  assert.equal(label.component.required, true);
  assert.deepEqual(
    label.component.options.map((o) => ({ label: o.label, value: o.value, default: o.default })),
    [
      { label: "Однострочный", value: "short", default: true },
      { label: "Многострочный", value: "long", default: undefined },
    ],
  );
});

test("modal: radioGroup without defaults leaves options unset", () => {
  const label = json(
    new V2ModalBuilder().setCustomId("m").setTitle("M")
      .radioGroup({
        label: "Тип",
        customId: "t",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
      })
      .build(),
  ).components[0];
  assert.equal(label.component.options[0].default, undefined);
  assert.equal(label.component.options[1].default, undefined);
});

test("modal: rebuilds the user's first example (create nabor)", () => {
  const executorId = "user_42";
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
    .roleSelect({ label: "Выберите роль которую получит пользователь", customId: "give_role", maxValues: 1, minValues: 1, required: true })
    .roleSelect({ label: "Выберите роль которая будет упомянута", customId: "mention_role", maxValues: 1, minValues: 1 })
    .channelSelect({ label: "Выберите канал для публикации", customId: "publish_channel", maxValues: 1, minValues: 1, channelTypes: [0] })
    .build();

  const data = json(modal);
  assert.equal(data.custom_id, "createNabor_modal:user_42");
  assert.equal(data.components.length, 4);
  assert.deepEqual(data.components.map((l) => l.label), [
    "Название набора",
    "Выберите роль которую получит пользователь",
    "Выберите роль которая будет упомянута",
    "Выберите канал для публикации",
  ]);
});

test("modal: rebuilds the user's second example (create question)", () => {
  const cacheKey = "cache_1";
  const modal = new V2ModalBuilder()
    .setCustomId(`createNewQuestion_modal:${cacheKey}`)
    .setTitle("Создание вопроса #1")
    .textInput({ label: "Укажите текст вопроса", customId: "question", minLength: 5, maxLength: 45, placeholder: "Например: Сколько вам лет?", required: false })
    .textInput({ label: "Укажите подсказку для ответа", customId: "placeholder", minLength: 5, maxLength: 100, style: "paragraph", placeholder: "Например: то что пишется тут", required: true })
    .textInput({ label: "Укажите минимальное количество символов", customId: "min_values", minLength: 1, maxLength: 4, placeholder: "Например: 1-4000", required: true })
    .textInput({ label: "Укажите максимальное количество символов", customId: "max_values", minLength: 1, maxLength: 4, placeholder: "Например: 1-4000", required: true })
    .radioGroup({
      label: "Укажите тип ввода",
      customId: "type_input",
      required: true,
      options: [
        { label: "Однострочный", value: "short", description: "Одна строка" },
        { label: "Многострочный", value: "long", description: "Одна и более" },
      ],
    })
    .build();

  const data = json(modal);
  assert.equal(data.custom_id, "createNewQuestion_modal:cache_1");
  assert.equal(data.components.length, 5);
  assert.equal(data.components[4].component.type, ComponentType.RadioGroup);
});
