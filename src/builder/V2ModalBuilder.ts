import {
	ChannelSelectMenuBuilder,
	ChannelType,
	ComponentType,
	LabelBuilder,
	MentionableSelectMenuBuilder,
	ModalBuilder,
	RadioGroupBuilder,
	RoleSelectMenuBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
	UserSelectMenuBuilder,
} from "discord.js";
import type { ModalSubmitFields, ModalSubmitInteraction } from "discord.js";
import { SelectMenuDefaultValueType } from "discord-api-types/v10";
import { parseEmoji } from "../core/emoji";

// Reusable, permissive builder shapes. Each mirrors the corresponding
// discord.js builder options but without the tedious low-level ceremony.

/** A single radio group option. */
export interface RadioGroupOptionData {
	label: string;
	value: string;
	description?: string;
	/** Mark the option as selected by default. */
	default?: boolean;
}

/** A single string-select option. */
export interface StringSelectOptionData {
	label: string;
	value: string;
	description?: string;
	/** Emoji as "👍", ":name:", "<:name:id>" or "<a:name:id>". */
	emoji?: string;
	default?: boolean;
}

/** Options shared by every select-menu style. */
export interface SelectMenuBaseData {
	/** Human-facing label shown above the menu. */
	label: string;
	/** Component custom_id. */
	customId: string;
	/** Secondary hint shown under the label. */
	description?: string;
	placeholder?: string;
	minValues?: number;
	maxValues?: number;
	required?: boolean;
}

/** @see {@link RoleSelectMenuBuilder} */
export interface RoleSelectMenuData extends SelectMenuBaseData {
	/** Pre-select roles by id. */
	roleIds?: string[];
}

/** @see {@link ChannelSelectMenuBuilder} */
export interface ChannelSelectMenuData extends SelectMenuBaseData {
	/** Allow only these channel types; omit for all. */
	channelTypes?: ChannelType[];
	/** Pre-select channels by id. */
	channelIds?: string[];
}

/** @see {@link UserSelectMenuBuilder} */
export interface UserSelectMenuData extends SelectMenuBaseData {
	/** Pre-select users by id. */
	userIds?: string[];
}

/** @see {@link MentionableSelectMenuBuilder} */
export interface MentionableSelectMenuData extends SelectMenuBaseData {
	/** Pre-select roles/users by id and type (1 = user, 2 = role). */
	defaults?: MentionableDefaultValue[];
}

/** @see {@link StringSelectMenuBuilder} */
export interface StringSelectMenuData extends SelectMenuBaseData {
	options: StringSelectOptionData[];
}

/** Text input plus the label that wraps it. */
export interface TextInputData {
	label: string;
	customId: string;
	/** Secondary hint shown under the label. */
	description?: string;
	style?: "short" | "paragraph" | TextInputStyle;
	placeholder?: string;
	minLength?: number;
	maxLength?: number;
	required?: boolean;
	/**
	 * Prefill the input with this value (editing flow). `undefined` is safe to
	 * pass (no value is set); the field can still be populated later with
	 * {@link V2ModalBuilder.setTextInputValue}.
	 */
	value?: string;
}

/** A radio group plus the label that wraps it. */
export interface RadioGroupData extends SelectMenuBaseData {
	options: RadioGroupOptionData[];
}

/** Options accepted by the {@link V2ModalBuilder} constructor. */
export interface V2ModalBuilderOptions {
	title?: string;
	customId?: string;
}

/**
 * What kind of interactive field a modal holds. Mirrors the field families of
 * {@link ModalSubmitFields} accessors so submit values can be parsed back.
 */
export type ModalFieldKind =
	| "text_input"
	| "role_select"
	| "channel_select"
	| "user_select"
	| "mentionable_select"
	| "string_select"
	| "radio_group";

/** One entry of the serializable field schema produced by {@link V2ModalBuilder.getSchema}. */
export interface ModalFieldSchema {
	customId: string;
	kind: ModalFieldKind;
}

/** Anything that can accept a built modal — structurally a discord.js interaction. */
export interface ModalTarget {
	showModal(modal: ModalBuilder): unknown;
}

/** Plain (untyped) result of {@link parseModalSubmit}. */
export type ModalFieldValues = Record<string, unknown>;

/** Minimal surface of discord.js {@link ModalSubmitFields} used by {@link parseModalSubmit}. */
export type ModalSubmitFieldsLike = Pick<
	ModalSubmitFields,
	| "getTextInputValue"
	| "getStringSelectValues"
	| "getRadioGroup"
	| "getSelectedRoles"
	| "getSelectedChannels"
	| "getSelectedUsers"
	| "getSelectedMentionables"
>;

/** Mentionable default-selection entry (type "user" or "role"). */
export interface MentionableDefaultValue {
	id: string;
	type: "user" | "role";
}

/** Same shape, but with the nominal API enum values discord.js expects. */
type MentionableApiValue =
	| { id: string; type: SelectMenuDefaultValueType.User }
	| { id: string; type: SelectMenuDefaultValueType.Role };

function toApiDefaults(values: readonly MentionableDefaultValue[]): MentionableApiValue[] {
	return values.map((v) =>
		v.type === "user"
			? { id: v.id, type: SelectMenuDefaultValueType.User }
			: { id: v.id, type: SelectMenuDefaultValueType.Role },
	);
}

/**
 * Reads the current `ModalSubmitInteraction` fields into a plain object keyed
 * by custom id. The schema can come from {@link V2ModalBuilder.getSchema} of
 * the same modal previewed elsewhere (submit handling often lives in a
 * different handler than the one that built the modal).
 */
export function parseModalSubmit(
	interaction: { fields: ModalSubmitFieldsLike },
	schema: readonly ModalFieldSchema[],
): ModalFieldValues {
	const out: ModalFieldValues = {};
	for (const { customId, kind } of schema) {
		switch (kind) {
			case "text_input":
				out[customId] = interaction.fields.getTextInputValue(customId);
				break;
			case "string_select":
				out[customId] = interaction.fields.getStringSelectValues(customId);
				break;
			case "radio_group":
				out[customId] = interaction.fields.getRadioGroup(customId);
				break;
			case "role_select":
				out[customId] = interaction.fields.getSelectedRoles(customId);
				break;
			case "channel_select":
				out[customId] = interaction.fields.getSelectedChannels(customId);
				break;
			case "user_select":
				out[customId] = interaction.fields.getSelectedUsers(customId);
				break;
			case "mentionable_select":
				out[customId] = interaction.fields.getSelectedMentionables(customId);
				break;
		}
	}
	return out;
}

/** @see {@link ModalComponentBuilder} */
export type ModalComponentBuilder =
	| TextInputBuilder
	| RoleSelectMenuBuilder
	| ChannelSelectMenuBuilder
	| UserSelectMenuBuilder
	| MentionableSelectMenuBuilder
	| StringSelectMenuBuilder
	| RadioGroupBuilder;

const TEXT_INPUT_STYLES: Record<
	NonNullable<TextInputData["style"]>,
	TextInputStyle
> = {
	short: TextInputStyle.Short,
	paragraph: TextInputStyle.Paragraph,
	[TextInputStyle.Short]: TextInputStyle.Short,
	[TextInputStyle.Paragraph]: TextInputStyle.Paragraph,
};

function resolveStyle(style: TextInputData["style"]): TextInputStyle {
	return style === undefined ? TextInputStyle.Short : TEXT_INPUT_STYLES[style];
}

/**
 * A tiny replacer so select options can be passed emoji as a friendly string
 * ("👍", ":name:", "<:name:id>") instead of a full emoji object.
 */
/** Parses "👍", ":name:", "<:name:id>" into an API emoji object. */
function toEmoji(emoji: string): { name?: string; id?: string; animated?: boolean } {
	return parseEmoji(emoji);
}

/** Extracts default-value ids of any given kind (numeric API value or string enum). */
function defaultIds(values: unknown, ...types: Array<number | string>): string[] {
	if (!Array.isArray(values)) return [];
	const set = new Set<string | number>(types);
	return values
		.filter((v) => v !== null && typeof v === "object" && set.has((v as { type?: unknown }).type as string | number))
		.map((v) => String((v as { id: unknown }).id));
}

function nonEmpty(value: string | undefined, fallback: string): string {
	return value !== undefined && value.trim().length > 0 ? value : fallback;
}

/**
 * V2 — simplified {@link ModalBuilder}.
 *
 * Wraps discord.js' new Components V2 modal API so you can describe a modal with
 * plain option objects instead of manually juggling `LabelBuilder` + inner
 * builders. Every interactive field is automatically wrapped in a
 * {@link LabelBuilder} and added to the modal for you.
 *
 * ```ts
 * const modal = new V2ModalBuilder()
 * 	.setTitle("Создание набора")
 * 	.setCustomId(`createNabor_modal:${executorId}`)
 * 	.textInput({
 * 		label: "Название набора",
 * 		customId: "name_nabor",
 * 		minLength: 3,
 * 		maxLength: 15,
 * 		placeholder: "например: Модератор",
 * 	})
 * 	.roleSelect({
 * 		label: "Выберите роль",
 * 		customId: "give_role",
 * 		required: true,
 * 	})
 * 	.radioGroup({
 * 		label: "Тип ввода",
 * 		customId: "type_input",
 * 		options: [
 * 			{ label: "Однострочный", value: "short" },
 * 			{ label: "Многострочный", value: "long" },
 * 		],
 * 	})
 * 	.build();
 *
 * await interaction.showModal(modal);
 * ```
 */
export class V2ModalBuilder {
	private readonly modal: ModalBuilder;
	private readonly fields = new Map<string, ModalComponentBuilder>();
	private readonly kinds = new Map<string, ModalFieldKind>();
	private readonly rules: Array<(builder: V2ModalBuilder) => string | null> = [];

	/**
	 * @param options Optionally seed the title and/or custom id up front, e.g.
	 * `new V2ModalBuilder({ title: "...", customId: "..." })`. Both can also be
	 * set later via {@link setTitle} / {@link setCustomId}.
	 */
	constructor(options: V2ModalBuilderOptions = {}) {
		this.modal = new ModalBuilder();
		if (options.title !== undefined) this.modal.setTitle(options.title);
		if (options.customId !== undefined) this.modal.setCustomId(options.customId);
	}

	/**
	 * Rebuilds a {@link V2ModalBuilder} from an existing modal — a discord.js
	 * `ModalBuilder`, anything with `toJSON()`, or raw API modal data
	 * (`{ title, custom_id, components }`). Useful for programmatic edits and
	 * for migrating legacy action-row modals into the labelled V2 shape.
	 */
	static from(source: unknown): V2ModalBuilder {
		const encodable = source as { toJSON?: () => unknown } | null;
		const json =
			source !== null &&
			typeof source === "object" &&
			typeof encodable?.toJSON === "function"
				? encodable.toJSON()
				: source;
		const data = (json ?? {}) as {
			title?: string;
			custom_id?: string;
			components?: Array<{
				type: number;
				label?: string;
				description?: string;
				component?: unknown;
				components?: unknown[];
			}>;
		};

		const builder = new V2ModalBuilder({ title: data.title, customId: data.custom_id });
		for (const entry of data.components ?? []) {
			if (entry.type === ComponentType.ActionRow) {
				for (const inner of entry.components ?? []) {
					V2ModalBuilder.fromInner(builder, inner);
				}
			} else if (entry.type === ComponentType.Label) {
				V2ModalBuilder.fromInner(builder, entry.component, entry.label, entry.description);
			}
		}
		return builder;
	}

	/** Underlying discord.js modal. Rarely needed — prefer {@link build}. */
	get inner(): ModalBuilder {
		return this.modal;
	}

	/** @see {@link ModalBuilder.setTitle} */
	setTitle(title: string): this {
		this.modal.setTitle(title);
		return this;
	}

	/** @see {@link ModalBuilder.setCustomId} */
	setCustomId(customId: string): this {
		this.modal.setCustomId(customId);
		return this;
	}

	/** Adds a labelled short/paragraph text input. */
	textInput(data: TextInputData): this {
		const input = new TextInputBuilder()
			.setCustomId(data.customId)
			.setStyle(resolveStyle(data.style))
			.setRequired(data.required ?? false);

		if (data.placeholder !== undefined) input.setPlaceholder(data.placeholder);
		if (data.minLength !== undefined) input.setMinLength(data.minLength);
		if (data.maxLength !== undefined) input.setMaxLength(data.maxLength);
		if (data.value !== undefined) input.setValue(data.value);

		this.registerField("text_input", data.customId, input);

		this.pushLabel(new LabelBuilder().setLabel(data.label).setTextInputComponent(input), data.description);
		return this;
	}

	/** Adds a labelled role select menu. */
	roleSelect(data: RoleSelectMenuData): this {
		const menu = new RoleSelectMenuBuilder()
			.setCustomId(data.customId)
			.setRequired(data.required ?? false);

		this.applySelectBase(menu, data);
		if (data.roleIds?.length) menu.setDefaultRoles(...data.roleIds);

		this.registerField("role_select", data.customId, menu);

		this.pushLabel(new LabelBuilder().setLabel(data.label).setRoleSelectMenuComponent(menu), data.description);
		return this;
	}

	/** Adds a labelled channel select menu. */
	channelSelect(data: ChannelSelectMenuData): this {
		const menu = new ChannelSelectMenuBuilder()
			.setCustomId(data.customId)
			.setRequired(data.required ?? false);

		this.applySelectBase(menu, data);
		if (data.channelTypes?.length) menu.setChannelTypes(...data.channelTypes);
		if (data.channelIds?.length) menu.setDefaultChannels(...data.channelIds);

		this.registerField("channel_select", data.customId, menu);

		this.pushLabel(new LabelBuilder().setLabel(data.label).setChannelSelectMenuComponent(menu), data.description);
		return this;
	}

	/** Adds a labelled user select menu. */
	userSelect(data: UserSelectMenuData): this {
		const menu = new UserSelectMenuBuilder()
			.setCustomId(data.customId)
			.setRequired(data.required ?? false);

		this.applySelectBase(menu, data);
		if (data.userIds?.length) menu.setDefaultUsers(...data.userIds);

		this.registerField("user_select", data.customId, menu);

		this.pushLabel(new LabelBuilder().setLabel(data.label).setUserSelectMenuComponent(menu), data.description);
		return this;
	}

	/** Adds a labelled mentionable select menu. */
	mentionableSelect(data: MentionableSelectMenuData): this {
		const menu = new MentionableSelectMenuBuilder()
			.setCustomId(data.customId)
			.setRequired(data.required ?? false);

		this.applySelectBase(menu, data);
		if (data.defaults?.length) menu.setDefaultValues(...toApiDefaults(data.defaults));

		this.registerField("mentionable_select", data.customId, menu);

		this.pushLabel(new LabelBuilder().setLabel(data.label).setMentionableSelectMenuComponent(menu), data.description);
		return this;
	}

	/** Adds a labelled string select menu with user-friendly options. */
	stringSelect(data: StringSelectMenuData): this {
		const menu = new StringSelectMenuBuilder().setCustomId(data.customId);
		menu.setOptions(
			data.options.map((o) => ({
				label: o.label,
				value: o.value,
				description: o.description,
				default: o.default,
				...((o.emoji && { emoji: toEmoji(o.emoji) }) as Record<string, unknown>),
			})),
		);

		this.applySelectBase(menu, data);

		this.registerField("string_select", data.customId, menu);

		this.pushLabel(new LabelBuilder().setLabel(data.label).setStringSelectMenuComponent(menu), data.description);
		return this;
	}

	/** Adds a labelled radio group. */
	radioGroup(data: RadioGroupData): this {
		const group = new RadioGroupBuilder()
			.setCustomId(data.customId)
			.setRequired(data.required ?? false);

		group.setOptions(
			data.options.map((o) => ({
				label: o.label,
				value: o.value,
				description: o.description,
				default: o.default,
			})),
		);

		this.registerField("radio_group", data.customId, group);

		this.pushLabel(new LabelBuilder().setLabel(data.label).setRadioGroupComponent(group), data.description);
		return this;
	}

	/**
	 * Returns the live discord.js builder for a field added earlier by custom id,
	 * or `undefined` when no such field exists. Mutations on the returned builder
	 * are reflected in the finished modal (e.g. `value`, `required`, options).
	 */
	component(customId: string): ModalComponentBuilder | undefined {
		return this.fields.get(customId);
	}

	/** Convenience getter for a text input added earlier by custom id. */
	textInputComponent(customId: string): TextInputBuilder | undefined {
		const field = this.fields.get(customId);
		return field instanceof TextInputBuilder ? field : undefined;
	}

	/**
	 * Serializable field schema — persist it and feed it to
	 * {@link parseModalSubmit} from the submit handler.
	 */
	getSchema(): ModalFieldSchema[] {
		return Array.from(this.kinds, ([customId, kind]) => ({ customId, kind }));
	}

	/**
	 * Reads the current `ModalSubmitInteraction` fields into a plain object
	 * keyed by the custom ids of this builder's fields. Pass a generic to get
	 * typed access (e.g. `parseSubmit<{ question: string; type_input: string }>(interaction)`).
	 */
	parseSubmit<T extends Record<string, unknown> = ModalFieldValues>(
		interaction: ModalSubmitInteraction,
	): T {
		return parseModalSubmit(interaction, this.getSchema()) as T;
	}

	/**
	 * Chainable helper that sets the value of a text input added earlier by
	 * custom id — useful when the value is only known after some checks.
	 *
	 * @throws when no text input is registered under the given custom id.
	 */
	setTextInputValue(customId: string, value: string): this {
		const input = this.textInputComponent(customId);
		if (!input) throw new Error(`No text input with custom id "${customId}"`);
		input.setValue(value);
		return this;
	}

	/** Marks exactly the option `value` as the default of a radio group. */
	setRadioGroupDefault(customId: string, value: string): this {
		const group = this.selectField(RadioGroupBuilder, "radio group", customId);
		let changed = false;
		for (const option of group.options) {
			if (option.data.value === value) {
				if (!option.data.default) option.setDefault(true);
				changed = true;
			} else if (option.data.default) {
				option.setDefault(false);
			}
		}
		if (!changed) throw new Error(`Radio group "${customId}" has no option "${value}"`);
		return this;
	}

	/** Selects the given options (by value) of a string select as defaults. */
	setStringSelectDefaults(customId: string, values: string[]): this {
		const menu = this.selectField(StringSelectMenuBuilder, "string select", customId);
		for (const option of menu.options) option.setDefault(values.includes(option.data.value ?? ""));
		return this;
	}

	/** Pre-selects roles by id on a role select menu. */
	setRoleSelectDefaults(customId: string, roleIds: string[]): this {
		this.selectField(RoleSelectMenuBuilder, "role select", customId).setDefaultRoles(...roleIds);
		return this;
	}

	/** Pre-selects channels by id on a channel select menu. */
	setChannelSelectDefaults(customId: string, channelIds: string[]): this {
		this.selectField(ChannelSelectMenuBuilder, "channel select", customId).setDefaultChannels(...channelIds);
		return this;
	}

	/** Pre-selects users by id on a user select menu. */
	setUserSelectDefaults(customId: string, userIds: string[]): this {
		this.selectField(UserSelectMenuBuilder, "user select", customId).setDefaultUsers(...userIds);
		return this;
	}

	/** Pre-selects roles/users by id on a mentionable select menu. */
	setMentionableSelectDefaults(customId: string, values: MentionableDefaultValue[]): this {
		this.selectField(MentionableSelectMenuBuilder, "mentionable select", customId).setDefaultValues(
			...toApiDefaults(values),
		);
		return this;
	}

	/**
	 * Adds a custom cross-field validation rule, evaluated by {@link build} /
	 * {@link validate}. Return an error message or `null`. The callback receives
	 * the builder itself, so it can inspect any field via {@link component}.
	 *
	 * ```ts
	 * new V2ModalBuilder({ ... })
	 *   .textInput({ label: "Мин", customId: "min_values" })
	 *   .textInput({ label: "Макс", customId: "max_values" })
	 *   .rule((b) => {
	 *     const min = Number(b.textInputComponent("min_values")?.data.value);
	 *     const max = Number(b.textInputComponent("max_values")?.data.value);
	 *     if (Number.isFinite(min) && Number.isFinite(max) && min > max)
	 *       return "min_values не может быть больше max_values";
	 *     return null;
	 *   });
	 * ```
	 */
	rule(check: (builder: V2ModalBuilder) => string | null): this {
		this.rules.push(check);
		return this;
	}

	/** Returns the list of problems with the current modal; empty means valid. */
	validate(): string[] {
		const problems: string[] = [];

		const { title, custom_id } = this.modal.data;
		if (title === undefined || title.length === 0) problems.push("Modal title is required");
		else if (title.length > 45) problems.push(`Modal title is ${title.length} chars; max is 45`);
		if (custom_id === undefined || custom_id.length === 0) problems.push("Modal custom id is required");
		else if (custom_id.length > 100) problems.push(`Modal custom id is ${custom_id.length} chars; max is 100`);

		const seen = new Set<string>();
		for (const label of this.modal.components) {
			if (!(label instanceof LabelBuilder)) continue;
			const { label: text, description, component } = label.data as unknown as {
				label?: string;
				description?: string;
				component?: { data?: { custom_id?: string } };
			};

			const cid = component?.data?.custom_id;
			if (cid === undefined || cid.length === 0) {
				problems.push("A labelled component is missing custom_id");
				continue;
			}
			if (seen.has(cid)) problems.push(`Duplicate custom id "${cid}"`);
			seen.add(cid);

			const len = text?.length ?? 0;
			if (len === 0 || len > 45) problems.push(`Label "${cid}" length is ${len}; 1..45`);
			if (description !== undefined && description.length > 100)
				problems.push(`Description "${cid}" is ${description.length} chars; max 100`);
		}

		for (const [customId, field] of this.fields) this.validateField(customId, field, problems);

		for (const rule of this.rules) {
			const error = rule(this);
			if (error) problems.push(error);
		}

		return problems;
	}

	/**
	 * Returns the finished discord.js {@link ModalBuilder}.
	 *
	 * @throws when {@link validate} finds problems (missing title/custom id,
	 * duplicate ids, cross-field inconsistencies or failing {@link rule}s).
	 */
	build(): ModalBuilder {
		const problems = this.validate();
		if (problems.length > 0) throw new Error(`Invalid modal:\n- ${problems.join("\n- ")}`);
		return this.modal;
	}

	/** Chainable terminal: validates and calls `interaction.showModal`. */
	async show(target: ModalTarget): Promise<void> {
		await target.showModal(this.build());
	}

	private registerField(kind: ModalFieldKind, customId: string, component: ModalComponentBuilder): void {
		this.fields.set(customId, component);
		this.kinds.set(customId, kind);
	}

	private validateField(customId: string, field: ModalComponentBuilder, problems: string[]): void {
		if (field instanceof TextInputBuilder) {
			const { min_length, max_length, value } = field.data;
			if (min_length !== undefined && max_length !== undefined && min_length > max_length)
				problems.push(`Text input "${customId}": minLength (${min_length}) > maxLength (${max_length})`);
			if (max_length !== undefined && typeof value === "string" && value.length > max_length)
				problems.push(`Text input "${customId}": prefilled value is ${value.length} chars; maxLength ${max_length}`);
			if (min_length !== undefined && typeof value === "string" && value.length < min_length)
				problems.push(`Text input "${customId}": prefilled value is ${value.length} chars; minLength ${min_length}`);
			return;
		}

		if (field instanceof RadioGroupBuilder) return;

		const { min_values, max_values } = field.data as { min_values?: number; max_values?: number };
		if (min_values !== undefined && max_values !== undefined && min_values > max_values)
			problems.push(`Select "${customId}": minValues (${min_values}) > maxValues (${max_values})`);
	}

	private selectField<T extends ModalComponentBuilder>(
		Constructor: new (...args: never[]) => T,
		kind: string,
		customId: string,
	): T {
		const field = this.fields.get(customId);
		if (!field) throw new Error(`No ${kind} with custom id "${customId}"`);
		if (!(field instanceof Constructor)) throw new Error(`Field "${customId}" is not a ${kind}`);
		return field;
	}

	private static fromInner(
		builder: V2ModalBuilder,
		inner: unknown,
		label?: string,
		description?: string,
	): void {
		const raw = (inner ?? {}) as {
			type?: number;
			custom_id?: string;
			style?: number;
			placeholder?: string;
			min_length?: number;
			max_length?: number;
			min_values?: number;
			max_values?: number;
			required?: boolean;
			value?: unknown;
			channel_types?: unknown;
			options?: unknown;
			default_values?: unknown;
		};

		const cid = raw.custom_id ?? "";
		const share = {
			label: nonEmpty(label, cid || "field"),
			customId: cid,
			description,
			placeholder: raw.placeholder,
			minValues: raw.min_values,
			maxValues: raw.max_values,
			required: raw.required,
		};

		switch (raw.type) {
			case ComponentType.TextInput:
				builder.textInput({
					label: share.label,
					customId: cid,
					description,
					style: raw.style as TextInputData["style"],
					placeholder: raw.placeholder,
					minLength: raw.min_length,
					maxLength: raw.max_length,
					required: raw.required,
					value: typeof raw.value === "string" ? raw.value : undefined,
				});
				break;
			case ComponentType.StringSelect:
				builder.stringSelect({
					...share,
					options: ((raw.options as unknown[]) ?? []).map((o) => {
						const opt = (o ?? {}) as {
							label?: unknown;
							value?: unknown;
							description?: unknown;
							default?: unknown;
							emoji?: unknown;
						};
						return {
							label: String(opt.label),
							value: String(opt.value),
							description: typeof opt.description === "string" ? opt.description : undefined,
							default: typeof opt.default === "boolean" ? opt.default : undefined,
							emoji:
								typeof opt.emoji === "string"
									? opt.emoji
									: opt.emoji !== null && opt.emoji !== undefined && typeof opt.emoji === "object"
										? ((opt.emoji as { name?: unknown }).name as string) ?? undefined
										: undefined,
						};
					}),
				});
				break;
			case ComponentType.RadioGroup:
				builder.radioGroup({
					label: share.label,
					customId: cid,
					description,
					required: raw.required,
					options: ((raw.options as unknown[]) ?? []).map((o) => {
						const opt = (o ?? {}) as { label?: unknown; value?: unknown; description?: unknown; default?: unknown };
						return {
							label: String(opt.label),
							value: String(opt.value),
							description: typeof opt.description === "string" ? opt.description : undefined,
							default: typeof opt.default === "boolean" ? opt.default : undefined,
						};
					}),
				});
				break;
			case ComponentType.RoleSelect:
				builder.roleSelect({
					...share,
					roleIds: defaultIds(raw.default_values, 2, "role"),
				});
				break;
			case ComponentType.ChannelSelect:
				builder.channelSelect({
					...share,
					channelTypes: (raw.channel_types as number[] | undefined) ?? [],
					channelIds: defaultIds(raw.default_values, 3, "channel"),
				});
				break;
			case ComponentType.UserSelect:
				builder.userSelect({
					...share,
					userIds: defaultIds(raw.default_values, 1, "user"),
				});
				break;
			case ComponentType.MentionableSelect:
				builder.mentionableSelect({
					...share,
					defaults: Array.isArray(raw.default_values)
						? (raw.default_values as Array<{ id: unknown; type: unknown }>).map((d): MentionableDefaultValue =>
								String(d.type) === "user"
									? { id: String(d.id), type: "user" }
									: { id: String(d.id), type: "role" },
							)
						: undefined,
				});
				break;
			default:
				throw new Error(`V2ModalBuilder.from: unsupported component type ${raw.type}`);
		}
	}

	private pushLabel(label: LabelBuilder, description?: string): void {
		if (description !== undefined) label.setDescription(description);
		this.modal.addLabelComponents(label);
	}

	private applySelectBase(
		menu: RoleSelectMenuBuilder | ChannelSelectMenuBuilder | UserSelectMenuBuilder | MentionableSelectMenuBuilder | StringSelectMenuBuilder,
		data: SelectMenuBaseData,
	): void {
		if (data.placeholder !== undefined) menu.setPlaceholder(data.placeholder);
		if (data.minValues !== undefined) menu.setMinValues(data.minValues);
		if (data.maxValues !== undefined) menu.setMaxValues(data.maxValues);
	}
}
