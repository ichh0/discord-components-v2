import assert from "node:assert/strict";
import test from "node:test";

import {
  ActionRowBuilder,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { V2ModalBuilder, parseModalSubmit } from "../../dist/index.js";

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
  assert.deepEqual(opts[1].emoji, { name: "sky", id: "123" });
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

test("modal: component() returns the live builder and mutations propagate", () => {
  const builder = new V2ModalBuilder().setCustomId("m").setTitle("M").textInput({ label: "Q", customId: "q" });
  const input = builder.component("q");
  assert.ok(input);
  assert.equal(input.data.custom_id, "q");
  input.setValue("после проверки");
  const label = json(builder.build()).components[0];
  assert.equal(label.component.value, "после проверки");
});

test("modal: component() returns undefined for unknown custom id", () => {
  const builder = new V2ModalBuilder().setCustomId("m").setTitle("M").textInput({ label: "Q", customId: "q" });
  assert.equal(builder.component("nope"), undefined);
});

test("modal: setTextInputValue is chainable and sets an existing field", () => {
  const builder = new V2ModalBuilder().setCustomId("m").setTitle("M").textInput({ label: "Q", customId: "q" });
  const same = builder.setTextInputValue("q", "значение");
  assert.equal(same, builder);
  assert.equal(json(builder.build()).components[0].component.value, "значение");
});

test("modal: setTextInputValue throws for unknown or non-text field", () => {
  const builder = new V2ModalBuilder().setCustomId("m").setTitle("M")
    .textInput({ label: "Q", customId: "q" })
    .radioGroup({ label: "Тип", customId: "t", options: [{ label: "A", value: "a" }] });
  assert.throws(() => builder.setTextInputValue("missing", "x"), /No text input with custom id/);
  assert.throws(() => builder.setTextInputValue("t", "x"), /No text input with custom id/);
  assert.ok(builder.component("t"));
  assert.equal(builder.textInputComponent("t"), undefined);
});

test("modal: value undefined is safe and can be set afterwards", () => {
  const builder = new V2ModalBuilder().setCustomId("m").setTitle("M")
    .textInput({ label: "Q", customId: "q", value: undefined });
  assert.equal(json(builder.build()).components[0].component.value, undefined);
  builder.setTextInputValue("q", "после");
  assert.equal(json(builder.build()).components[0].component.value, "после");
});

test("modal: parseSubmit reads fields back by custom id", () => {
  const fields = {
    getTextInputValue: (cid) => ({ question: "Сколько вам лет?", min_values: "1" })[cid],
    getStringSelectValues: (cid) => ({ pick: ["a", "c"] })[cid],
    getRadioGroup: (cid) => ({ type_input: "short" })[cid],
    getSelectedRoles: () => null,
    getSelectedChannels: () => null,
    getSelectedUsers: () => null,
    getSelectedMentionables: () => null,
  };

  const builder = new V2ModalBuilder()
    .textInput({ label: "Q", customId: "question" })
    .textInput({ label: "min", customId: "min_values" })
    .stringSelect({
      label: "P",
      customId: "pick",
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
        { label: "C", value: "c" },
      ],
    })
    .radioGroup({
      label: "T",
      customId: "type_input",
      options: [
        { label: "short", value: "short" },
        { label: "long", value: "long" },
      ],
    });

  const values = builder.parseSubmit({ fields });
  assert.equal(values.question, "Сколько вам лет?");
  assert.equal(values.min_values, "1");
  assert.deepEqual(values.pick, ["a", "c"]);
  assert.equal(values.type_input, "short");

  assert.deepEqual(builder.getSchema(), [
    { customId: "question", kind: "text_input" },
    { customId: "min_values", kind: "text_input" },
    { customId: "pick", kind: "string_select" },
    { customId: "type_input", kind: "radio_group" },
  ]);

  const standalone = parseModalSubmit(
    { fields },
    [
      { customId: "question", kind: "text_input" },
      { customId: "type_input", kind: "radio_group" },
    ],
  );
  assert.equal(standalone.question, "Сколько вам лет?");
  assert.equal(standalone.type_input, "short");
});

test("modal: select/radio defaults can be set after adding", () => {
  const builder = new V2ModalBuilder().setCustomId("m").setTitle("M")
    .radioGroup({ label: "T", customId: "t", options: [{ label: "A", value: "a", default: true }, { label: "B", value: "b" }] })
    .stringSelect({ label: "P", customId: "p", options: [{ label: "A", value: "a" }, { label: "B", value: "b" }, { label: "C", value: "c" }] })
    .roleSelect({ label: "R", customId: "r" })
    .channelSelect({ label: "C", customId: "c" })
    .userSelect({ label: "U", customId: "u" })
    .mentionableSelect({ label: "M", customId: "men" });

  builder.setRadioGroupDefault("t", "b");
  builder.setStringSelectDefaults("p", ["a", "c"]);
  builder.setRoleSelectDefaults("r", ["111"]);
  builder.setChannelSelectDefaults("c", ["222"]);
  builder.setUserSelectDefaults("u", ["333"]);
  builder.setMentionableSelectDefaults("men", [{ id: "444", type: "role" }, { id: "555", type: "user" }]);

  const comps = json(builder.build()).components.map((l) => l.component);
  assert.deepEqual(comps[0].options.map((o) => o.default), [false, true]);
  assert.deepEqual(comps[1].options.map((o) => o.default), [true, false, true]);
  assert.deepEqual(comps[2].default_values, [{ id: "111", type: "role" }]);
  assert.deepEqual(comps[3].default_values, [{ id: "222", type: "channel" }]);
  assert.deepEqual(comps[4].default_values, [{ id: "333", type: "user" }]);
  assert.deepEqual(comps[5].default_values, [
    { id: "444", type: "role" },
    { id: "555", type: "user" },
  ]);
});

test("modal: setRadioGroupDefault throws for unknown option", () => {
  const builder = new V2ModalBuilder().setCustomId("m").setTitle("M")
    .radioGroup({ label: "T", customId: "t", options: [{ label: "A", value: "a" }, { label: "B", value: "b" }] });
  assert.throws(() => builder.setRadioGroupDefault("t", "nope"), /no option "nope"/);
  assert.throws(() => builder.setRadioGroupDefault("missing", "a"), /No radio group with custom id/);
});

test("modal: from() round-trips a modal JSON", () => {
  const original = new V2ModalBuilder()
    .setCustomId("m:x:1")
    .setTitle("Заголовок")
    .textInput({ label: "Вопрос", customId: "question", required: true, style: "paragraph", placeholder: "ph", minLength: 5, maxLength: 45, value: "префилл" })
    .radioGroup({ label: "Тип", customId: "type_input", required: true, options: [{ label: "A", value: "a", default: true }, { label: "B", value: "b" }] })
    .roleSelect({ label: "Роль", customId: "give_role", roleIds: ["111"] })
    .build();
  const originalJson = original.toJSON();

  const rebuilt = V2ModalBuilder.from(originalJson).build();
  assert.deepEqual(rebuilt.toJSON(), originalJson);
});

test("modal: from() migrates a legacy action-row modal", () => {
  const legacy = new ModalBuilder()
    .setCustomId("legacy")
    .setTitle("Старая")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("a")
          .setLabel("Поле A")
          .setStyle(TextInputStyle.Short)
          .setValue("значение"),
      ),
    );

  const rebuilt = V2ModalBuilder.from(legacy).build().toJSON();
  assert.equal(rebuilt.custom_id, "legacy");
  assert.equal(rebuilt.components.length, 1);
  assert.equal(rebuilt.components[0].type, ComponentType.Label);
  assert.equal(rebuilt.components[0].component.custom_id, "a");
  assert.equal(rebuilt.components[0].component.value, "значение");
});

test("modal: build() throws with problems (title/id/duplicates/limits)", () => {
  assert.throws(
    () => new V2ModalBuilder().textInput({ label: "Q", customId: "q" }).build(),
    /title|custom id/,
  );

  const dup = new V2ModalBuilder().setCustomId("m").setTitle("M")
    .textInput({ label: "Q1", customId: "dup" })
    .textInput({ label: "Q2", customId: "dup" });
  assert.throws(() => dup.build(), /Duplicate custom id "dup"/);

  const range = new V2ModalBuilder().setCustomId("m").setTitle("M")
    .textInput({ label: "Q", customId: "q", minLength: 10, maxLength: 5 });
  assert.throws(() => range.build(), /minLength \(10\) > maxLength \(5\)/);

  const selectRange = new V2ModalBuilder().setCustomId("m").setTitle("M")
    .stringSelect({ label: "S", customId: "s", minValues: 3, maxValues: 1, options: [{ label: "A", value: "a" }, { label: "B", value: "b" }] });
  assert.throws(() => selectRange.build(), /minValues \(3\) > maxValues \(1\)/);
});

test("modal: rule() adds cross-field validation run on build", () => {
  const builder = new V2ModalBuilder().setCustomId("m").setTitle("M")
    .textInput({ label: "Мин", customId: "min_values" })
    .textInput({ label: "Макс", customId: "max_values" })
    .rule((b) => {
      const min = Number(b.textInputComponent("min_values")?.data.value);
      const max = Number(b.textInputComponent("max_values")?.data.value);
      return Number.isFinite(min) && Number.isFinite(max) && min > max ? "min не может быть больше max" : null;
    });

  builder.setTextInputValue("min_values", "10").setTextInputValue("max_values", "5");
  assert.throws(() => builder.build(), /min не может быть больше max/);

  builder.setTextInputValue("min_values", "1").setTextInputValue("max_values", "5");
  assert.doesNotThrow(() => builder.build());
});

test("modal: show() calls target.showModal with the validated modal", async () => {
  const shown = [];
  const target = {
    showModal: async (modal) => {
      shown.push(modal);
    },
  };
  const builder = new V2ModalBuilder({ title: "T", customId: "c" })
    .textInput({ label: "Q", customId: "q" });
  await builder.show(target);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].toJSON().custom_id, "c");
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
