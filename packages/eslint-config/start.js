import { tanstackConfig } from "@tanstack/eslint-config";

/** @type {import("eslint").Linter.Config} */
export const config = [
	...tanstackConfig,
	{
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
					ignoreRestSiblings: true,
				},
			],
		},
	},
];
