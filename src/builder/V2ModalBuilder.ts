import {
	ChannelSelectMenuBuilder,
	ChannelType,
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
}

/** @see {@link UserSelectMenuBuilder} */
export interface UserSelectMenuData extends SelectMenuBaseData {
	/** Pre-select users by id. */
	userIds?: string[];
}

/** @see {@link MentionableSelectMenuBuilder} */
export interface MentionableSelectMenuData extends SelectMenuBaseData {}

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
	/** Prefill the input with this value (editing flow). */
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
function toEmoji(emoji: string): { name?: string; id?: string; animated?: boolean } {
	const custom = /^<(a?):(\w+):(\d+)>$/.exec(emoji.trim());
	if (custom)
		return { animated: custom[1] === "a", name: custom[2], id: custom[3] };
	const shortcode = /^:(\w+):$/.exec(emoji.trim());
	if (shortcode) return { name: shortcode[1] };
	return { name: emoji };
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

		this.pushLabel(new LabelBuilder().setLabel(data.label).setUserSelectMenuComponent(menu), data.description);
		return this;
	}

	/** Adds a labelled mentionable select menu. */
	mentionableSelect(data: MentionableSelectMenuData): this {
		const menu = new MentionableSelectMenuBuilder()
			.setCustomId(data.customId)
			.setRequired(data.required ?? false);

		this.applySelectBase(menu, data);
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

		this.pushLabel(new LabelBuilder().setLabel(data.label).setRadioGroupComponent(group), data.description);
		return this;
	}

	/** Returns the finished discord.js {@link ModalBuilder}. */
	build(): ModalBuilder {
		return this.modal;
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
