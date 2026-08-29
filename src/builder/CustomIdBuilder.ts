/** Discord rejects any `custom_id` longer than 100 characters. */
export const CUSTOM_ID_MAX_LENGTH = 100;

/**
 * Thrown by {@link CustomIdBuilder.build} when a custom id would be invalid
 * (empty name, `:` inside a part, or over the 100-character limit).
 */
export class CustomIdError extends Error {
	constructor(message: string) {
		super(`CustomIdBuilder: ${message}`);
		this.name = "CustomIdError";
	}
}

export type CustomIdName = "_selectmenu" | "_button" | "_modal" | (string & {});

/** Segments accepted by {@link CustomIdBuilder.build}. `"not"` means "absent". */
export interface CustomIdParts<TName extends CustomIdName = CustomIdName> {
	name: TName;
	entityId?: "not" | (string & {});
	executorId?: "not" | (string & {});
	/** Extra positional segments appended after `executorId` (still joined by `:`). */
	rest?: string[];
}

/** Result of {@link CustomIdBuilder.parse}. */
export interface ParsedCustomId<TName extends CustomIdName = CustomIdName> {
	name: TName;
	entityId?: string;
	executorId?: string;
	rest: string[];
	raw: string;
	length: number;
}

const ABSENT = new Set(["not"]);

function isAbsent(value: string | undefined | null): boolean {
	return value === undefined || value === null || value === "" || ABSENT.has(value);
}

/**
 * Simple, dependency-free custom id codec for Discord components.
 *
 * Mirrors the classic `CIB` pattern (`name:entityId:executorId`, always joined
 * by `:`), but enforces the 100-character API limit, drops `"not"`/empty
 * segments, rejects parts containing `:`, and gives small helpers so ids stay
 * well under the cap.
 *
 * ```ts
 * const id = CustomIdBuilder.build({ name: "_modal", entityId: draft.id, executorId }); // "_modal:x7k:555"
 * CustomIdBuilder.parse(id); // { name: "_modal", entityId: "x7k", executorId: "555", ... }
 * CustomIdBuilder.is(id, "_modal"); // true
 * ```
 */
export class CustomIdBuilder {
	private constructor() {}

	/** Joins `name:entityId:executorId:rest…` skipping undefined/empty/`"not"`. */
	static assemble<TName extends CustomIdName>(data: CustomIdParts<TName>): string {
		for (const seg of [data.name, data.entityId, data.executorId, ...(data.rest ?? [])]) {
			if (typeof seg === "string" && seg.includes(":")) {
				throw new CustomIdError(
					`segment ${JSON.stringify(seg)} contains ":" which corrupts parsing`,
				);
			}
		}
		if (isAbsent(data.name)) {
			throw new CustomIdError("name is required and must not be empty");
		}
		const parts = [data.name, data.entityId, data.executorId, ...(data.rest ?? [])].filter(
			(v): v is string => !isAbsent(v as string),
		);
		return parts.join(":");
	}

	/** Builds and validates a custom id (throws {@link CustomIdError} on overflow). */
	static build<TName extends CustomIdName>(data: CustomIdParts<TName>): string {
		const customId = CustomIdBuilder.assemble(data);
		if (customId.length > CUSTOM_ID_MAX_LENGTH) {
			throw new CustomIdError(
				`max ${CUSTOM_ID_MAX_LENGTH} chars, got ${customId.length} ` +
					`(shrink by ${customId.length - CUSTOM_ID_MAX_LENGTH})`,
			);
		}
		return customId;
	}

	/** Lenient split of `customId` into parts. Never throws. */
	static parse<TName extends CustomIdName = CustomIdName>(customId: string): ParsedCustomId<TName> {
		const parts = typeof customId === "string" ? customId.split(":") : [];
		const [name, entityId, executorId, ...rest] = parts;
		return {
			name: (name ?? "") as TName,
			entityId,
			executorId,
			rest: rest ?? [],
			raw: customId,
			length: customId.length,
		};
	}

	/** True when `customId` is a non-empty string ≤100 chars with a name part. */
	static isValid(customId: string): boolean {
		return (
			typeof customId === "string" &&
			customId.length > 0 &&
			customId.length <= CUSTOM_ID_MAX_LENGTH &&
			Boolean(customId.split(":")[0])
		);
	}

	/** `isValid` + name match — the fastest way to route handlers. */
	static is<TName extends CustomIdName>(customId: string, name: TName): boolean {
		return CustomIdBuilder.isValid(customId) && CustomIdBuilder.parse(customId).name === name;
	}

	/** Length the joined id would occupy (no validation, no build()). */
	static capacityOf<TName extends CustomIdName>(data: CustomIdParts<TName>): number {
		return CustomIdBuilder.assemble(data).length;
	}

	/** Free characters left before the 100 limit (negative when over budget). */
	static remaining<TName extends CustomIdName>(data: CustomIdParts<TName>): number {
		return CUSTOM_ID_MAX_LENGTH - CustomIdBuilder.capacityOf(data);
	}
}