module.exports = [
	...require("@abinnovision/eslint-config-base"),
	...require("@abinnovision/eslint-config-typescript"),
	{ files: ["**/*.js"], languageOptions: { globals: require("globals").node } },
];
