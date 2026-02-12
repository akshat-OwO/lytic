import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const clientEnv = createEnv({
	client: {
		VITE_CONVEX_URL: z.string().url(),
	},
	clientPrefix: "VITE_",
	runtimeEnv: import.meta.env,
	emptyStringAsUndefined: true,
});
