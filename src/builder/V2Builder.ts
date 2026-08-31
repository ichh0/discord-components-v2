import {
	APIActionRowComponent,
	APIComponentInMessageActionRow,
	APIContainerComponent,
	APIMediaGalleryItem,
	APISelectMenuOption,
	ButtonStyle,
	ChannelType,
	ComponentType,
	SeparatorSpacingSize,
} from "discord-api-types/v10";
import {
	LIMITS,
	IS_COMPONENTS_V2,
	EPHEMERAL,
	type RawComponent,
} from "../core/constants";
import { isContainer } from "../core/guards";
import {
	hasComponentType,
	isRecord,
	normalizeComponents,
	toRaw,
} from "../core/normalize";
import type { ComponentSelector } from "../core/selector";
import { validateComponents } from "../core/validate";
import { type ComponentRef, findComponent, findComponents } from "../core/walk";
import {
	getTextContents,
	matchesButtonIds,
	disableButtons as opDisableButtons,
	enableButtons as opEnableButtons,
	removeComponents as opRemoveComponents,
	clearSelectValues as opClearSelectValues,
	removeSelectMenus as opRemoveSelectMenus,
	findSelectMenu as opFindSelectMenu,
	getSelectMenus as opGetSelectMenus,
	renameCustomId as opRenameCustomId,
	replaceSelectMenu as opReplaceSelectMenu,
	setButtonEmoji as opSetButtonEmoji,
	setButtonStyle as opSetButtonStyle,
	setButtonUrl as opSetButtonUrl,
	setSelectDisabled as opSetSelectDisabled,
	setSelectMinMaxValues as opSetSelectMinMaxValues,
	setSelectOptions as opSetSelectOptions,
	setSelectPlaceholder as opSetSelectPlaceholder,
	setButtonLabel as opSetButtonLabel,
	setDisabled as opSetDisabled,
	replaceText as opReplaceText,
	type SelectMenuMatchOptions,
	type SelectOptionInput,
} from "../edit/operations";
import {
	coerceKindValue,
	getAllByKind,
	getByKind,
	isComponentKind,
	kindGroup,
	moveByKind,
	removeByKind,
	replaceByKind,
	type ComponentKind,
	type IndexedChildRef,
	type KindTarget,
} from "../edit/kinds";
import type {
	ButtonOptions,
	ButtonStyleName,
	ChannelSelectOptions,
	FieldOptions,
	FilePayload,
	MediaItemOptions,
	SectionOptions,
	SendOptions,
	SendTarget,
	StringSelectOptions,
} from "./types";

export * from "./types";

/**
 * Ready-to-send payload returned by {@link V2Builder.build}.
 * Spread it directly into any discord.js call:
 *
 * ```ts
 * await interaction.reply(builder.build());
 * ```
 */
export interface V2Payload {
	content?: string;
	components: RawComponent[];
	files?: FilePayload[];
	flags: number;
}

const BUTTON_STYLES: Record<ButtonStyleName, ButtonStyle> = {
	Primary: ButtonStyle.Primary,
	Secondary: ButtonStyle.Secondary,
	Success: ButtonStyle.Success,
	Danger: ButtonStyle.Danger,
	Link: ButtonStyle.Link,
	Premium: ButtonStyle.Premium,
};

type ContainerChild = APIContainerComponent["components"][number];

import { parseEmoji } from "../core/emoji";
export { parseEmoji };

/**
 * Fluent builder for Discord Components V2 messages.
 *
 * The builder owns a single root container (the standard layout for CV2),
 * produces plain JSON compatible with discord.js v14 and — most importantly —
 * can be re-created from any existing message via {@link V2Builder.parse},
 * making caches unnecessary: fetch → parse → edit → send.
 *
 * Indexed access to container children is kind-based: either the generic
 * methods (`builder.remove("section", 1)`, `builder.replace({ kind: "section", index: 1 }, node)`)
 * or the per-kind namespaces (`builder.sections.remove(1)`,
 * `builder.textDisplays.set(2, "hello")`).
 */
export class V2Builder {
	private containerData: APIContainerComponent;
	private attachments: FilePayload[] = [];
	private plainContent: string | null = null;

	/**
	 * @param data Either container metadata (`{ accent_color, spoiler, id }`)
	 *   or a plain array of children. An array is accepted so that awkward
	 *   sources work out of the box:
	 *
	 *   - `new V2Builder(message.components)`
	 *   - `new V2Builder(ctx.message.components[0].components)` (CV2 container children)
	 *   - `parseComponents(ctx.message.components)`
	 *
	 *   Unknown fields are dropped on purpose — spreading arbitrary input used
	 *   to leak indexed keys (`"0": {...}`) into the serialized container,
	 *   which the Discord API rejects.
	 */
	constructor(data?: Partial<APIContainerComponent> | readonly unknown[]) {
		// Absorb a single Container from an array (e.g. fr.components → [container])
		// just like parse() does, to avoid wrapping it in another Container.
		if (
			Array.isArray(data) &&
			data.length === 1 &&
			isContainer(data[0] as RawComponent)
		) {
			const c = JSON.parse(JSON.stringify(data[0])) as APIContainerComponent;
			this.containerData = {
				type: ComponentType.Container,
				components: c.components ?? [],
			};
			if (typeof c.id === "number") this.containerData.id = c.id;
			if (c.accent_color !== undefined && c.accent_color !== null) {
				this.containerData.accent_color = c.accent_color;
			}
			if (typeof c.spoiler === "boolean")
				this.containerData.spoiler = c.spoiler;
			return;
		}

		const source: Partial<APIContainerComponent> = Array.isArray(data)
			? { components: data as APIContainerComponent["components"] }
			: { ...((data as Partial<APIContainerComponent> | undefined) ?? {}) };

		this.containerData = {
			type: ComponentType.Container,
			components: Array.isArray(source.components)
				? (JSON.parse(
						JSON.stringify(source.components),
					) as APIContainerComponent["components"])
				: [],
		};
		if (typeof source.id === "number") this.containerData.id = source.id;
		if (source.accent_color !== undefined && source.accent_color !== null) {
			this.containerData.accent_color = source.accent_color;
		}
		if (typeof source.spoiler === "boolean")
			this.containerData.spoiler = source.spoiler;
	}

	// ------------------------------------------------------------------
	// Parsing (разборщик)
	// ------------------------------------------------------------------

	/**
	 * Parses existing components back into a builder.
	 *
	 * Accepted inputs:
	 * - raw component array (e.g. `message.components` mapped through `toJSON()`)
	 * - a single component
	 * - message-like objects `{ components }` (fetched discord.js Message works too)
	 * - anything exposing `toJSON()` (discord.js builders)
	 *
	 * A single top-level Container is absorbed with all its metadata
	 * (accent color, spoiler, children). Any other shape is wrapped into an
	 * implicit container so the fluent API keeps working.
	 */
	static parse(input: unknown): V2Builder {
		let candidate: unknown = input;
		if (candidate !== null && typeof candidate === "object") {
			candidate = toRaw(candidate);
		}

		// Locate a message-like source to keep its plain content. A fetched
		// Message has BOTH `type` (a *message* type like 20) and `components`,
		// so we check for a valid component type instead of mere presence of
		// the `type` field. Arrays may wrap whole messages too
		// (e.g. `[await ctx.fetchReply()]`).
		let messageSource: Record<string, unknown> | null = null;
		if (Array.isArray(candidate)) {
			for (const element of candidate) {
				const raw = toRaw<Record<string, unknown> | null | undefined>(element);
				if (
					isRecord(raw) &&
					Array.isArray(raw.components) &&
					!hasComponentType(raw)
				) {
					messageSource = raw;
					break;
				}
			}
		} else if (
			isRecord(candidate) &&
			Array.isArray(candidate.components) &&
			!hasComponentType(candidate)
		) {
			messageSource = candidate;
		}

		const builder = new V2Builder();

		if (messageSource && typeof messageSource.content === "string") {
			builder.plainContent = messageSource.content;
		}

		const roots = normalizeComponents(candidate) as RawComponent[];

		if (roots.length === 1 && isContainer(roots[0])) {
			builder.containerData = roots[0];
		} else if (roots.length > 0) {
			builder.containerData.components =
				roots as APIContainerComponent["components"];
		}
		return builder;
	}

	// ------------------------------------------------------------------
	// Content methods
	// ------------------------------------------------------------------

	/** Adds a markdown text block (TextDisplay). */
	text(content: string): this {
		this.containerData.components.push({
			type: ComponentType.TextDisplay,
			content,
		});
		return this;
	}

	/** Sets the plain message content shown above the components. */
	content(value: string): this {
		this.plainContent = value;
		return this;
	}

	/** Sets the numeric component id of the root container. */
	setId(id: number): this {
		this.containerData.id = id;
		return this;
	}

	/** Adds a "**name**\nvalue" pair as its own text block. */
	field(name: string, value: string, inline = false): this {
		const formatted = inline ? `**${name}** ${value}` : `**${name}**\n${value}`;
		return this.text(formatted);
	}

	/** Renders name/value pairs as an aligned two-column ANSI code block. */
	fields(fields: FieldOptions[]): this {
		if (!fields.length) return this;

		let combined = "```ansi\n";
		const maxLeftNameLength = Math.max(...fields.map((f) => f.name.length));

		for (let i = 0; i < fields.length; i += 2) {
			const left = fields[i];
			const right = fields[i + 1];

			if (left && right) {
				const paddedLeftName = left.name.padEnd(maxLeftNameLength + 4, " ");
				combined += `${paddedLeftName}${right.name}\n`;
				const leftValueStr = `└─ ${left.value}`;
				const paddedLeftValue = leftValueStr.padEnd(maxLeftNameLength + 4, " ");
				combined += `${paddedLeftValue}└─ ${right.value}\n\n`;
			} else if (left) {
				combined += `${left.name}\n└─ ${left.value}\n`;
			}
		}
		combined += "```";

		if (combined.trim()) this.text(combined.trim());
		return this;
	}

	// ------------------------------------------------------------------
	// Layout components
	// ------------------------------------------------------------------

	separator(
		size: SeparatorSpacingSize = SeparatorSpacingSize.Small,
		divider = true,
	): this {
		this.containerData.components.push({
			type: ComponentType.Separator,
			spacing: size,
			divider,
		});
		return this;
	}

	section(params: SectionOptions): this {
		const section: Record<string, unknown> = {
			type: ComponentType.Section,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: params.content
						? `${params.title}\n${params.content}`
						: `${params.title}`,
				},
			],
		};

		if (params.button) {
			section.accessory = buildButton(params.button);
		} else if (params.thumbnailUrl) {
			section.accessory = {
				type: ComponentType.Thumbnail,
				media: { url: params.thumbnailUrl },
				...(params.thumbnailDescription
					? { description: params.thumbnailDescription }
					: {}),
				...(params.spoiler ? { spoiler: true } : {}),
			};
		} else {
			throw new Error("section(): provide either 'button' or 'thumbnailUrl'");
		}

		this.containerData.components.push(section as unknown as ContainerChild);
		return this;
	}

	/** Media gallery from plain URLs / attachment references. */
	gallery(items: Array<string | MediaItemOptions>): this {
		if (!items.length) return this;
		this.containerData.components.push({
			type: ComponentType.MediaGallery,
			items: items.map((item) => buildGalleryItem(item)),
		});
		return this;
	}

	/** Registers a buffer/string attachment and shows it in a gallery. */
	media(buffer: Buffer | string, filename?: string): this {
		const name = filename ?? `image_${Date.now()}.png`;
		this.attachments.push({ attachment: buffer, name });
		return this.gallery([{ url: `attachment://${name}` }]);
	}

	/** Single-image gallery from a URL with optional description/spoiler. */
	mediaUrl(url: string, description?: string, spoiler = false): this {
		return this.gallery([{ url, description, spoiler }]);
	}

	/** Displays an uploaded file inside the message (requires the file payload). */
	file(
		bufferOrPayload: Buffer | string | FilePayload,
		maybeName?: string,
		spoiler = false,
	): this {
		let payload: FilePayload;

		if (
			typeof bufferOrPayload === "object" &&
			!Buffer.isBuffer(bufferOrPayload)
		) {
			payload = bufferOrPayload;
		} else {
			payload = {
				attachment: bufferOrPayload,
				name: maybeName ?? `file_${Date.now()}`,
			};
		}

		this.attachments.push(payload);
		this.containerData.components.push({
			type: ComponentType.File,
			file: { url: `attachment://${payload.name}` },
			...(spoiler ? { spoiler: true } : {}),
		});
		return this;
	}

	color(hex: number): this {
		this.containerData.accent_color = hex;
		return this;
	}

	spoiler(enabled = true): this {
		this.containerData.spoiler = enabled;
		return this;
	}

	// ------------------------------------------------------------------
	// Interactive components
	// ------------------------------------------------------------------

	/** Adds one action row with up to 5 buttons. */
	buttons(...buttons: ButtonOptions[]): this {
		if (!buttons.length) return this;
		if (buttons.length > LIMITS.MAX_ACTION_ROW_CHILDREN) {
			throw new Error(
				`buttons(): max ${LIMITS.MAX_ACTION_ROW_CHILDREN} per row, got ${buttons.length}`,
			);
		}
		const row: APIActionRowComponent<APIComponentInMessageActionRow> = {
			type: ComponentType.ActionRow,
			components: buttons.map(buildButton),
		};
		this.containerData.components.push(row);
		return this;
	}

	/** Adds one action row with a single select menu. */
	selectMenu: SelectMenuApi<this> = {
		string: (params: StringSelectOptions): this => {
			const options: APISelectMenuOption[] = params.options.map((opt) => ({
				label: opt.label,
				value: opt.value,
				default: opt.default ?? false,
				...(opt.description ? { description: opt.description } : {}),
				...(opt.emoji ? { emoji: parseEmoji(opt.emoji) } : {}),
			}));
			return this.pushSelect(
				{
					type: ComponentType.StringSelect,
					custom_id: params.customId,
					options,
				},
				params,
			);
		},

		user: (params: SelectParams): this =>
			this.pushSelect(
				{ type: ComponentType.UserSelect, custom_id: params.customId },
				params,
			),

		role: (params: SelectParams): this =>
			this.pushSelect(
				{ type: ComponentType.RoleSelect, custom_id: params.customId },
				params,
			),

		mentionable: (params: SelectParams): this =>
			this.pushSelect(
				{ type: ComponentType.MentionableSelect, custom_id: params.customId },
				params,
			),

		channel: (params: ChannelSelectOptions): this =>
			this.pushSelect(
				{
					type: ComponentType.ChannelSelect,
					custom_id: params.customId,
					...(params.channelTypes
						? { channel_types: params.channelTypes }
						: {}),
				},
				params,
			),
	};

	private pushSelect(
		base: Record<string, unknown>,
		params: SelectParams,
	): this {
		const menu = {
			...base,
			...(params.placeholder ? { placeholder: params.placeholder } : {}),
			...(params.minValues !== undefined
				? { min_values: params.minValues }
				: {}),
			...(params.maxValues !== undefined
				? { max_values: params.maxValues }
				: {}),
			...(params.disabled !== undefined ? { disabled: params.disabled } : {}),
		};
		this.containerData.components.push({
			type: ComponentType.ActionRow,
			components: [menu as APIComponentInMessageActionRow],
		});
		return this;
	}

	// ------------------------------------------------------------------
	// Editing utilities (work on parsed or freshly built data alike)
	// ------------------------------------------------------------------

	disableButtons(customIds?: string | string[]): this {
		opDisableButtons(this.containerData.components, {
			customIds,
			disabled: true,
		});
		return this;
	}

	enableButtons(customIds?: string | string[]): this {
		opEnableButtons(this.containerData.components, customIds);
		return this;
	}

	setDisabled(selector: ComponentSelector, disabled = true): this {
		opSetDisabled(this.containerData.components, selector, disabled);
		return this;
	}

	setButtonLabel(customId: string, label: string): this {
		opSetButtonLabel(this.containerData.components, customId, label);
		return this;
	}

	/**
	 * Removes matching components. Accepts:
	 * - a selector (`"pick"`, `ComponentType`, regex, predicate),
	 * - a kind target (`remove({ kind: "section", index: 1 })`),
	 * - a kind + index pair (`remove("textDisplay", 2)`).
	 *
	 * Empty rows are pruned automatically.
	 */
	remove(target: KindTarget): this;
	remove(kind: ComponentKind, index: number): this;
	remove(selector: ComponentSelector): this;
	remove(
		kindOrTargetOrSelector: ComponentKind | KindTarget | ComponentSelector,
		maybeIndex?: number,
	): this {
		const arg = kindOrTargetOrSelector;
		if (typeof arg === "string" && isComponentKind(arg) && typeof maybeIndex === "number") {
			removeByKind(this.kindChildren, arg, maybeIndex);
			return this;
		}
		if (
			arg !== null &&
			typeof arg === "object" &&
			"kind" in arg &&
			"index" in arg &&
			isComponentKind((arg as KindTarget).kind)
		) {
			removeByKind(this.kindChildren, (arg as KindTarget).kind, (arg as KindTarget).index);
			return this;
		}
		opRemoveComponents(this.containerData.components, arg as ComponentSelector);
		return this;
	}

	removeButtons(customIds?: string | string[]): this {
		return this.remove((c) => matchesButtonIds(c, customIds));
	}

	/** Removes every select menu matching `type` and/or `custom_ids`; empty rows are pruned. */
	removeSelectMenus(options?: SelectMenuMatchOptions): this {
		opRemoveSelectMenus(this.containerData.components as RawComponent[], options);
		return this;
	}

	/**
	 * Clears the chosen values of matching select menus (`default_values` /
	 * string-select option `default`), so the same menu can fire again.
	 */
	clearSelectValues(options?: SelectMenuMatchOptions): this {
		opClearSelectValues(this.containerData.components as RawComponent[], options);
		return this;
	}

	/** Sets (or removes, when `undefined`) the placeholder of a select by custom_id. */
	setSelectPlaceholder(customId: string, placeholder?: string): this {
		opSetSelectPlaceholder(this.containerData.components as RawComponent[], customId, placeholder);
		return this;
	}

	/** Replaces the options of a string select found by custom_id (`emoji` as a string). */
	setSelectOptions(customId: string, options: SelectOptionInput[]): this {
		opSetSelectOptions(this.containerData.components as RawComponent[], customId, options);
		return this;
	}

	/** Sets (or removes, when `undefined`) min/max values of a select by custom_id. */
	setSelectMinMaxValues(customId: string, min?: number, max?: number): this {
		opSetSelectMinMaxValues(this.containerData.components as RawComponent[], customId, min, max);
		return this;
	}

	/** Enables/disables the matching select menus (default: disabled). */
	setSelectDisabled(options?: SelectMenuMatchOptions, disabled = true): this {
		opSetSelectDisabled(this.containerData.components as RawComponent[], options, disabled);
		return this;
	}

	/** Returns every select menu matching `type` and/or `custom_ids`. */
	getSelectMenus(options?: SelectMenuMatchOptions): RawComponent[] {
		return opGetSelectMenus(this.containerData.components as RawComponent[], options);
	}

	/** Returns the first select menu matching `type` and/or `custom_ids`, or null. */
	findSelectMenu(options?: SelectMenuMatchOptions): RawComponent | null {
		return opFindSelectMenu(this.containerData.components as RawComponent[], options);
	}

	/** Replaces the first select menu matching `options` with `replacement`. */
	replaceSelectMenu(options: SelectMenuMatchOptions, replacement: RawComponent): this {
		opReplaceSelectMenu(this.containerData.components as RawComponent[], options, replacement);
		return this;
	}

	/** Changes a button style by custom_id (keeps the payload valid). */
	setButtonStyle(customId: string, style: number): this {
		opSetButtonStyle(this.containerData.components as RawComponent[], customId, style);
		return this;
	}

	/** Sets (or removes, when `undefined`) a button emoji by custom_id. */
	setButtonEmoji(customId: string, emoji?: string): this {
		opSetButtonEmoji(this.containerData.components as RawComponent[], customId, emoji);
		return this;
	}

	/** Sets a button URL by custom_id (converts to a Link button); `undefined` removes it. */
	setButtonUrl(customId: string, url?: string): this {
		opSetButtonUrl(this.containerData.components as RawComponent[], customId, url);
		return this;
	}

	/** Renames the custom_id on every matching component; throws if nothing matched. */
	renameCustomId(from: string, to: string): this {
		opRenameCustomId(this.containerData.components as RawComponent[], from, to);
		return this;
	}

	replaceText(
		search: string | RegExp,
		replacement: string | ((substring: string, ...args: unknown[]) => string),
	): this {
		opReplaceText(this.containerData.components, search, replacement);
		return this;
	}

	find(selector: ComponentSelector): ComponentRef | null {
		return findComponent(
			this.containerData.components as RawComponent[],
			selector,
		);
	}

	findAll(selector: ComponentSelector): ComponentRef[] {
		return findComponents(
			this.containerData.components as RawComponent[],
			selector,
		);
	}

	getTexts(): string[] {
		return getTextContents(this.containerData.components as RawComponent[]);
	}

	// ------------------------------------------------------------------
	// Kind-indexed management
	// ------------------------------------------------------------------

	private get kindChildren(): RawComponent[] {
		return this.containerData.components as RawComponent[];
	}

	/** Returns every container child of the given kind (with their indices). */
	all(kind: ComponentKind): IndexedChildRef[] {
		return getAllByKind(this.kindChildren, kind);
	}

	/** Returns one container child of the given kind, or null if not found. */
	get(target: KindTarget): IndexedChildRef | null;
	get(kind: ComponentKind, index: number): IndexedChildRef | null;
	get(kindOrTarget: ComponentKind | KindTarget, index?: number): IndexedChildRef | null {
		if (typeof kindOrTarget === "string") {
			return getByKind(this.kindChildren, kindOrTarget, index as number);
		}
		const { kind, index: i } = kindOrTarget;
		return getByKind(this.kindChildren, kind, i);
	}

	/**
	 * Replaces a container child in place. Accepts a kind target + value
	 * (`replace({ kind: "section", index: 1 }, node)`) or a kind + index + value
	 * (`replace("textDisplay", 0, "hello")`). For `textDisplay` the value may
	 * be a plain content string.
	 */
	set(target: KindTarget, value: RawComponent | string): this;
	set(kind: ComponentKind, index: number, value: RawComponent | string): this;
	set(
		kindOrTarget: ComponentKind | KindTarget,
		indexOrValue: number | RawComponent | string,
		maybeValue?: RawComponent | string,
	): this {
		if (typeof kindOrTarget === "string") {
			replaceByKind(this.kindChildren, kindOrTarget, indexOrValue as number, coerceKindValue(kindOrTarget, maybeValue as RawComponent | string));
		} else {
			const { kind, index } = kindOrTarget;
			replaceByKind(this.kindChildren, kind, index, coerceKindValue(kind, indexOrValue as RawComponent | string));
		}
		return this;
	}

	/** Alias for {@link set}: replaces a container child in place with a raw component. */
	replace(target: KindTarget, node: RawComponent): this;
	replace(kind: ComponentKind, index: number, node: RawComponent): this;
	replace(
		kindOrTarget: ComponentKind | KindTarget,
		indexOrNode: number | RawComponent,
		maybeNode?: RawComponent,
	): this {
		if (typeof kindOrTarget === "string") {
			replaceByKind(this.kindChildren, kindOrTarget, indexOrNode as number, maybeNode as RawComponent);
		} else {
			const { kind, index } = kindOrTarget;
			replaceByKind(this.kindChildren, kind, index, indexOrNode as RawComponent);
		}
		return this;
	}

	/** Moves a container child from one kind-index to another (rare — see `lib/advanced`). */
	move(target: KindTarget, to: number): this;
	move(kind: ComponentKind, from: number, to: number): this;
	move(
		kindOrTarget: ComponentKind | KindTarget,
		fromOrTo: number,
		maybeTo?: number,
	): this {
		if (typeof kindOrTarget === "string") {
			moveByKind(this.kindChildren, kindOrTarget, fromOrTo, maybeTo as number);
		} else {
			const { kind, index } = kindOrTarget;
			moveByKind(this.kindChildren, kind, index, fromOrTo);
		}
		return this;
	}

	/** Namespaced section access (`builder.sections.remove(1)`). */
	sections = kindGroup<this>(this, () => this.containerData.components as RawComponent[], "section");
	/** Namespaced separator access (`builder.separators.all()`). */
	separators = kindGroup<this>(this, () => this.containerData.components as RawComponent[], "separator");
	/** Namespaced text access (`builder.textDisplays.set(2, "hello")`). */
	textDisplays = kindGroup<this>(this, () => this.containerData.components as RawComponent[], "textDisplay");
	/** Namespaced action-row access. */
	actionRows = kindGroup<this>(this, () => this.containerData.components as RawComponent[], "actionRow");
	/** Namespaced media-gallery access. */
	mediaGalleries = kindGroup<this>(this, () => this.containerData.components as RawComponent[], "mediaGallery");

	// ------------------------------------------------------------------
	// Output
	// ------------------------------------------------------------------

	/** The raw root container. */
	toJSON(): APIContainerComponent {
		return this.containerData;
	}

	getAttachments(): FilePayload[] {
		return this.attachments;
	}

	clear(): this {
		this.containerData = { type: ComponentType.Container, components: [] };
		this.attachments = [];
		this.plainContent = null;
		return this;
	}

	/**
	 * Validates and returns the full send payload.
	 * Spread it straight into discord.js calls.
	 */
	build(): V2Payload {
		const components: RawComponent[] = [this.containerData];
		const errors = validateComponents(components);
		if (!errors.valid) {
			throw new Error(`Invalid components:\n- ${errors.errors.join("\n- ")}`);
		}

		const payload: V2Payload = {
			components,
			flags: IS_COMPONENTS_V2,
		};
		if (this.plainContent) payload.content = this.plainContent;
		if (this.attachments.length > 0) payload.files = [...this.attachments];
		return payload;
	}

	/**
	 * Sends via an interaction (reply / editReply depending on state) or edits
	 * a fetched message (`message.edit`).
	 */
	async send(target: SendTarget, options: SendOptions = {}): Promise<unknown> {
		const payload = this.build();
		const flags =
			payload.flags |
			(options.ephemeral ? EPHEMERAL : 0) |
			(options.extraFlags ?? 0);

		const body = { ...payload, ...options, flags };

		if (
			typeof target.reply === "function" &&
			!target.replied &&
			!target.deferred
		) {
			return target.reply(body);
		}
		if (typeof target.editReply === "function") {
			return target.editReply(body);
		}
		if (typeof target.followUp === "function") {
			return target.followUp(body);
		}
		if (typeof target.edit === "function") {
			return target.edit(body);
		}
		throw new Error(
			"send(): unsupported target (no reply/editReply/edit method found)",
		);
	}
}

export interface SelectParams {
	customId: string;
	placeholder?: string;
	minValues?: number;
	maxValues?: number;
	disabled?: boolean;
}

/**
 * Sub-namespace for adding a single select menu row
 * (`builder.selectMenu.string(...)`). `T` lets the methods keep the concrete
 * builder type through the chain.
 */
export interface SelectMenuApi<T extends V2Builder = V2Builder> {
	string(params: StringSelectOptions): T;
	user(params: SelectParams): T;
	role(params: SelectParams): T;
	mentionable(params: SelectParams): T;
	channel(params: ChannelSelectOptions): T;
}

/** Standalone parser: components / message-like / builder-like data → editable builder. */
export function parseComponents(input: unknown): V2Builder {
	return V2Builder.parse(input);
}

function buildButton(options: ButtonOptions): APIComponentInMessageActionRow {
	if (!options.url && !options.id && !options.skuId) {
		throw new Error("Button must have either 'id', 'url' or 'skuId'");
	}

	if (options.url) {
		return {
			type: ComponentType.Button,
			style: ButtonStyle.Link,
			url: options.url,
			...(options.label ? { label: options.label } : {}),
			...(options.disabled ? { disabled: true } : {}),
			...(options.emoji ? { emoji: parseEmoji(options.emoji) } : {}),
		} as APIComponentInMessageActionRow;
	}

	if (options.skuId) {
		return {
			type: ComponentType.Button,
			style: ButtonStyle.Premium,
			sku_id: options.skuId,
			...(options.disabled ? { disabled: true } : {}),
		} as APIComponentInMessageActionRow;
	}

	if (!options.label && !options.emoji) {
		throw new Error("Button must have either 'label' or 'emoji'");
	}

	return {
		type: ComponentType.Button,
		style: BUTTON_STYLES[options.style ?? "Secondary"],
		custom_id: options.id!,
		...(options.label ? { label: options.label } : {}),
		...(options.disabled ? { disabled: true } : {}),
		...(options.emoji ? { emoji: parseEmoji(options.emoji) } : {}),
	} as APIComponentInMessageActionRow;
}

function buildGalleryItem(
	item: string | MediaItemOptions,
): APIMediaGalleryItem {
	if (typeof item === "string") return { media: { url: item } };
	return {
		media: { url: item.url },
		...(item.description ? { description: item.description } : {}),
		...(item.spoiler ? { spoiler: true } : {}),
	};
}