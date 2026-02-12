import { createEnv } from "@t3-oss/env-core";
import z from "zod";

export const serverEnv = createEnv({
	server: {
		CLERK_PUBLISHABLE_KEY: z.string().min(1),
		CLERK_SECRET_KEY: z.string().min(1),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
