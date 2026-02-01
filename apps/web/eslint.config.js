import { config } from "@workspace/eslint-config/start";

/** @type {import("eslint").Linter.Config} */
export default [
	{
		ignores: ["*.config.js", "*.config.ts"],
	},
	...config,
];
