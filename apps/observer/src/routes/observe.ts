import { zValidator } from "@hono/zod-validator";
import { Effect, Logger } from "effect";
import { Hono } from "hono";

import { Monitor } from "../lib/monitor.js";
import { observeSchema } from "../lib/schemas.js";

const observerRouter = new Hono();

observerRouter.post("/", zValidator("json", observeSchema), async (c) => {
	const data = c.req.valid("json");

	const program = Effect.gen(function* () {
		const result = yield* Monitor.execute(data);
		return result;
	}).pipe(
		Effect.provide(Monitor.Default),
		Effect.provide(Logger.pretty),
		Effect.scoped,
	);

	const result = await Effect.runPromise(program);

	return c.json({
		success: true,
		data: {
			url: data.url,
			deviceType: data.deviceType,
			reports: {
				json: result.jsonFilepath,
				html: result.htmlFilepath,
			},
			scores: {
				performance:
					result.lighthouseResult.categories.performance?.score,
				accessibility:
					result.lighthouseResult.categories.accessibility?.score,
				bestPractices:
					result.lighthouseResult.categories["best-practices"]?.score,
				seo: result.lighthouseResult.categories.seo?.score,
			},
		},
	});
});

export default observerRouter;
