/** Parses "👍", ":name:", "<:name:id>", "<a:name:id>" into an API emoji object. */
export function parseEmoji(input: string): {
	name?: string;
	id?: string;
	animated?: boolean;
} {
	const custom = /^<(a?):(\w+):(\d+)>$/.exec(input.trim());
	if (custom) {
		if (custom[1] === "a") return { animated: true, name: custom[2], id: custom[3] };
		return { name: custom[2], id: custom[3] };
	}
	const shortcode = /^:(\w+):$/.exec(input.trim());
	if (shortcode) return { name: shortcode[1] };
	return { name: input };
}