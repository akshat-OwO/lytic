import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		AUTH_TOKEN: z.string().min(1),
		R2_ACCOUNT_ID: z.string().min(1),
		R2_ACCESS_KEY_ID: z.string().min(1),
		R2_SECRET_ACCESS_KEY: z.string().min(1),
		R2_BUCKET_NAME: z.string().min(1),
		WEBHOOK_RETRY_MAX_ATTEMPTS: z.coerce
			.number()
			.int()
			.min(1)
			.max(10)
			.optional()
			.default(3),
		WEBHOOK_RETRY_BASE_DELAY_MS: z.coerce
			.number()
			.int()
			.min(100)
			.max(60_000)
			.optional()
			.default(1000),
		WEBHOOK_ALLOWED_HOSTS: z.string().optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
