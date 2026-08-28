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
	type ActionRowRef,
	getTextContents,
	type MediaGalleryRef,
	matchesButtonIds,
	disableButtons as opDisableButtons,
	enableButtons as opEnableButtons,
	getActionRow as opGetActionRow,
	getActionRows as opGetActionRows,
	getMediaGalleries as opGetMediaGalleries,
	getMediaGallery as opGetMediaGallery,
	getSection as opGetSection,
	getSections as opGetSections,
	getSeparator as opGetSeparator,
	getSeparators as opGetSeparators,
	getTextDisplay as opGetTextDisplay,
	getTextDisplays as opGetTextDisplays,
	keepOnly as opKeepOnly,
	moveActionRow as opMoveActionRow,
	moveMediaGallery as opMoveMediaGallery,
	moveSection as opMoveSection,
	moveSeparator as opMoveSeparator,
	moveTextDisplay as opMoveTextDisplay,
	removeActionRow as opRemoveActionRow,
	removeComponents as opRemoveComponents,
	removeMediaGallery as opRemoveMediaGallery,
	removeSection as opRemoveSection,
	removeSeparator as opRemoveSeparator,
	removeTextDisplay as opRemoveTextDisplay,
	replaceActionRow as opReplaceActionRow,
	replaceMediaGallery as opReplaceMediaGallery,
	replaceSection as opReplaceSection,
	replaceSeparator as opReplaceSeparator,
	replaceText as opReplaceText,
	replaceTextDisplay as opReplaceTextDisplay,
	setButtonLabel as opSetButtonLabel,
	setDisabled as opSetDisabled,
	type SectionRef,
	type SeparatorRef,
	type TextDisplayRef,
} from "../edit/operations";
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

/** Parses "👍", ":name:", "<:name:id>", "<a:name:id>" into an API emoji object. */
export function parseEmoji(input: string): {
	name?: string;
	id?: string;
	animated?: boolean;
} {
	const custom = /^<(a?):(\w+):(\d+)>$/.exec(input.trim());
	if (custom)
		return { animated: custom[1] === "a", name: custom[2], id: custom[3] };
	const shortcode = /^:(\w+):$/.exec(input.trim());
	if (shortcode) return { name: shortcode[1] };
	return { name: input };
}

/**
 * Fluent builder for Discord Components V2 messages.
 *
 * The builder owns a single root container (the standard layout for CV2),
 * produces plain JSON compatible with discord.js v14 and — most importantly —
 * can be re-created from any existing message via {@link V2Builder.parse},
 * making caches unnecessary: fetch → parse → edit → send.
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

	/** Alias of {@link V2Builder.parse}. */
	static from(input: unknown): V2Builder {
		return V2Builder.parse(input);
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
	selectMenu = {
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

	/** Completely removes matching components; empty rows are pruned automatically. */
	remove(selector: ComponentSelector): this {
		opRemoveComponents(this.containerData.components, selector);
		return this;
	}

	removeButtons(customIds?: string | string[]): this {
		return this.remove((c) => matchesButtonIds(c, customIds));
	}

	/** Removes everything except matching subtrees. */
	keepOnly(selector: ComponentSelector): this {
		opKeepOnly(this.containerData.components, selector);
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
	// Section management
	// ------------------------------------------------------------------

	/** Returns all top-level Section components with their indices. */
	getSections(): SectionRef[] {
		return opGetSections(this.containerData.components as RawComponent[]);
	}

	/** Returns a single Section by its section-index, or null if not found. */
	getSection(index: number): SectionRef | null {
		return opGetSection(this.containerData.components as RawComponent[], index);
	}

	/** Removes a Section by its section-index. Returns `this` for chaining. */
	removeSection(index: number): this {
		opRemoveSection(this.containerData.components as RawComponent[], index);
		return this;
	}

	/** Replaces a Section in-place by its section-index. Returns `this` for chaining. */
	replaceSection(index: number, replacement: RawComponent): this {
		opReplaceSection(
			this.containerData.components as RawComponent[],
			index,
			replacement,
		);
		return this;
	}

	/** Moves a Section from one section-index to another. Returns `this` for chaining. */
	moveSection(from: number, to: number): this {
		opMoveSection(this.containerData.components as RawComponent[], from, to);
		return this;
	}

	// ------------------------------------------------------------------
	// Separator management
	// ------------------------------------------------------------------

	/** Returns all top-level Separator components with their indices. */
	getSeparators(): SeparatorRef[] {
		return opGetSeparators(this.containerData.components as RawComponent[]);
	}

	/** Returns a single Separator by its separator-index, or null if not found. */
	getSeparator(index: number): SeparatorRef | null {
		return opGetSeparator(
			this.containerData.components as RawComponent[],
			index,
		);
	}

	/** Removes a Separator by its separator-index. Returns `this` for chaining. */
	removeSeparator(index: number): this {
		opRemoveSeparator(this.containerData.components as RawComponent[], index);
		return this;
	}

	/** Replaces a Separator in-place by its separator-index. Returns `this` for chaining. */
	replaceSeparator(index: number, replacement: RawComponent): this {
		opReplaceSeparator(
			this.containerData.components as RawComponent[],
			index,
			replacement,
		);
		return this;
	}

	/** Moves a Separator from one separator-index to another. Returns `this` for chaining. */
	moveSeparator(from: number, to: number): this {
		opMoveSeparator(this.containerData.components as RawComponent[], from, to);
		return this;
	}

	// ------------------------------------------------------------------
	// TextDisplay management
	// ------------------------------------------------------------------

	/** Returns all top-level TextDisplay components with their indices. */
	getTextDisplays(): TextDisplayRef[] {
		return opGetTextDisplays(this.containerData.components as RawComponent[]);
	}

	/** Returns a single TextDisplay by its index, or null if not found. */
	getTextDisplay(index: number): TextDisplayRef | null {
		return opGetTextDisplay(
			this.containerData.components as RawComponent[],
			index,
		);
	}

	/** Removes a TextDisplay by its index. Returns `this` for chaining. */
	removeTextDisplay(index: number): this {
		opRemoveTextDisplay(this.containerData.components as RawComponent[], index);
		return this;
	}

	/** Replaces a TextDisplay in-place by its index. Returns `this` for chaining. */
	replaceTextDisplay(index: number, replacement: RawComponent): this {
		opReplaceTextDisplay(
			this.containerData.components as RawComponent[],
			index,
			replacement,
		);
		return this;
	}

	/** Moves a TextDisplay from one index to another. Returns `this` for chaining. */
	moveTextDisplay(from: number, to: number): this {
		opMoveTextDisplay(
			this.containerData.components as RawComponent[],
			from,
			to,
		);
		return this;
	}

	// ------------------------------------------------------------------
	// MediaGallery management
	// ------------------------------------------------------------------

	/** Returns all top-level MediaGallery components with their indices. */
	getMediaGalleries(): MediaGalleryRef[] {
		return opGetMediaGalleries(this.containerData.components as RawComponent[]);
	}

	/** Returns a single MediaGallery by its index, or null if not found. */
	getMediaGallery(index: number): MediaGalleryRef | null {
		return opGetMediaGallery(
			this.containerData.components as RawComponent[],
			index,
		);
	}

	/** Removes a MediaGallery by its index. Returns `this` for chaining. */
	removeMediaGallery(index: number): this {
		opRemoveMediaGallery(
			this.containerData.components as RawComponent[],
			index,
		);
		return this;
	}

	/** Replaces a MediaGallery in-place by its index. Returns `this` for chaining. */
	replaceMediaGallery(index: number, replacement: RawComponent): this {
		opReplaceMediaGallery(
			this.containerData.components as RawComponent[],
			index,
			replacement,
		);
		return this;
	}

	/** Moves a MediaGallery from one index to another. Returns `this` for chaining. */
	moveMediaGallery(from: number, to: number): this {
		opMoveMediaGallery(
			this.containerData.components as RawComponent[],
			from,
			to,
		);
		return this;
	}

	// ------------------------------------------------------------------
	// ActionRow management
	// ------------------------------------------------------------------

	/** Returns all top-level ActionRow components with their indices. */
	getActionRows(): ActionRowRef[] {
		return opGetActionRows(this.containerData.components as RawComponent[]);
	}

	/** Returns a single ActionRow by its index, or null if not found. */
	getActionRow(index: number): ActionRowRef | null {
		return opGetActionRow(
			this.containerData.components as RawComponent[],
			index,
		);
	}

	/** Removes an ActionRow by its index. Returns `this` for chaining. */
	removeActionRow(index: number): this {
		opRemoveActionRow(this.containerData.components as RawComponent[], index);
		return this;
	}

	/** Replaces an ActionRow in-place by its index. Returns `this` for chaining. */
	replaceActionRow(index: number, replacement: RawComponent): this {
		opReplaceActionRow(
			this.containerData.components as RawComponent[],
			index,
			replacement,
		);
		return this;
	}

	/** Moves an ActionRow from one index to another. Returns `this` for chaining. */
	moveActionRow(from: number, to: number): this {
		opMoveActionRow(this.containerData.components as RawComponent[], from, to);
		return this;
	}

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

interface SelectParams {
	customId: string;
	placeholder?: string;
	minValues?: number;
	maxValues?: number;
	disabled?: boolean;
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
