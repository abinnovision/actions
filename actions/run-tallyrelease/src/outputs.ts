/** Parses `$GITHUB_OUTPUT` text: `key=value` lines and `key<<DELIM` blocks. A repeated key keeps its last value. */
export const parseGithubOutput = (text: string): Map<string, string> => {
	const outputs = new Map<string, string>();
	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const eq = line.indexOf("=");
		const heredoc = line.indexOf("<<");
		if (heredoc > 0 && (eq === -1 || heredoc < eq)) {
			const delimiter = line.slice(heredoc + 2);
			const end = lines.indexOf(delimiter, i + 1);
			if (end === -1) {
				break;
			}
			outputs.set(line.slice(0, heredoc), lines.slice(i + 1, end).join("\n"));
			i = end;
		} else if (eq > 0) {
			outputs.set(line.slice(0, eq), line.slice(eq + 1));
		}
	}

	return outputs;
};
