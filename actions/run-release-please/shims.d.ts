declare module "release-please/build/src/util/tag-name" {
	export class TagName {
		component?: string;
		version: import("release-please/build/src/version").Version;
		separator: string;
		includeV: boolean;
		constructor(
			version: import("release-please/build/src/version").Version,
			component?: string,
			separator?: string,
			includeV?: boolean,
		);
		static parse(tagName: string): TagName | undefined;
		toString(): string;
	}
}

declare module "release-please/build/src/version" {
	export class Version {
		readonly major: number;
		readonly minor: number;
		readonly patch: number;
		readonly preRelease?: string;
		readonly build?: string;
		constructor(
			major: number,
			minor: number,
			patch: number,
			preRelease?: string,
			build?: string,
		);
		static parse(versionString: string): Version;
		compare(other: Version): -1 | 0 | 1;
		toString(): string;
	}
}
