export interface BuildDownloadUrlInput {
	owner: string;
	repo: string;
	tag: string;
	file: string;
}

export const buildDownloadUrl = (input: BuildDownloadUrlInput): string =>
	`https://github.com/${input.owner}/${input.repo}/releases/download/${encodeURIComponent(
		input.tag,
	)}/${input.file}`;
