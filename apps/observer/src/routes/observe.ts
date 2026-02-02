import { zValidator } from "@hono/zod-validator";
import { Effect, Logger } from "effect";
import { Hono } from "hono";
import { nanoid } from "nanoid";

import { Monitor } from "../lib/monitor.js";
import { BrowserLaunchError, LighthouseAuditError } from "../lib/monitor.js";
import {
	type DeviceType,
	type JobId,
	type JobMetadata,
	observeSchema,
} from "../lib/schemas.js";
import { R2UploadError, Storage } from "../lib/storage.js";
import { Webhook, WebhookSendError } from "../lib/webhook.js";

const observerRouter = new Hono();

// Error handling helper
const handleError = (params: {
	jobId: JobId;
	url: string;
	deviceType: DeviceType;
	webhookUrl: string;
	createdAt: string;
	webhookSecret?: string;
	error: unknown;
}) => {
	return Effect.gen(function* () {
		const storage = yield* Storage;
		const webhook = yield* Webhook;

		const { jobId, url, deviceType, webhookUrl, webhookSecret, createdAt } =
			params;
		const error = params.error as
			| BrowserLaunchError
			| LighthouseAuditError
			| R2UploadError
			| WebhookSendError
			| { _tag: string; message: string };

		// Determine error code and message based on error type
		let errorCode = "UNKNOWN_ERROR";
		let errorMessage = "An unknown error occurred";

		if (error._tag === "BrowserLaunchError") {
			errorCode = "BROWSER_LAUNCH_FAILED";
			errorMessage = (error as BrowserLaunchError).message;
		} else if (error._tag === "LighthouseAuditError") {
			errorCode = "LIGHTHOUSE_AUDIT_FAILED";
			errorMessage = (error as LighthouseAuditError).message;
		} else if (error._tag === "R2UploadError") {
			errorCode = "STORAGE_ERROR";
			errorMessage = (error as R2UploadError).message;
		} else if (error._tag === "WebhookSendError") {
			// Webhook errors are logged but don't fail the job
			return;
		}

		// Update job metadata to failed state
		const failedMetadata: JobMetadata = {
			jobId,
			url,
			deviceType,
			status: "failed",
			createdAt,
			completedAt: new Date().toISOString(),
			webhookUrl,
			error: {
				code: errorCode,
				message: errorMessage,
			},
		};

		yield* storage
			.uploadJson(`jobs/${jobId}/meta.json`, failedMetadata)
			.pipe(Effect.catchAll(() => Effect.succeed(undefined)));

		// Send failure webhook
		const payload = webhook.createPayload({
			jobId,
			status: "failed",
			url,
			deviceType,
			reportKey: `jobs/${jobId}/report.json`,
			error: { code: errorCode, message: errorMessage },
		});

		yield* webhook.send(webhookUrl, payload, webhookSecret).pipe(
			Effect.catchTag("WebhookSendError", () =>
				Effect.succeed(undefined),
			),
			Effect.catchAll(() => Effect.succeed(undefined)),
		);
	});
};

observerRouter.post("/", zValidator("json", observeSchema), async (c) => {
	const data = c.req.valid("json");

	// Generate job ID
	const jobId = nanoid() as JobId;
	const createdAt = new Date().toISOString();

	// Create main program
	const program = Effect.gen(function* () {
		const storage = yield* Storage;
		const monitor = yield* Monitor;
		const webhook = yield* Webhook;

		// Create initial job metadata
		const jobMetadata: JobMetadata = {
			jobId,
			url: data.url,
			deviceType: data.deviceType as DeviceType,
			status: "pending",
			createdAt,
			webhookUrl: data.webhookUrl,
		};

		// Save initial job state
		yield* storage.uploadJson(`jobs/${jobId}/meta.json`, jobMetadata);

		yield* Effect.log("Job created", { jobId, url: data.url });

		// Update to running state
		const runningMetadata = { ...jobMetadata, status: "running" as const };
		yield* storage.uploadJson(`jobs/${jobId}/meta.json`, runningMetadata);

		// Run the monitor (3 lighthouse runs with aggregation)
		const result = yield* monitor.execute({
			url: data.url,
			deviceType: data.deviceType as DeviceType,
			jobId,
			runCount: 3,
		});

		// Update to completed state
		const completedMetadata = {
			...runningMetadata,
			status: "completed" as const,
			completedAt: new Date().toISOString(),
		};
		yield* storage.uploadJson(`jobs/${jobId}/meta.json`, completedMetadata);

		// Create webhook payload
		const payload = webhook.createPayload({
			jobId,
			status: "completed",
			url: data.url,
			deviceType: data.deviceType as DeviceType,
			reportKey: result.reportKey,
			summary: {
				scores: result.aggregatedReport.scores,
				metrics: result.aggregatedReport.metrics,
			},
		});

		// Send webhook
		yield* webhook.send(data.webhookUrl, payload, data.webhookSecret).pipe(
			Effect.tapError((error) =>
				Effect.logError("Webhook delivery failed", {
					jobId,
					webhookUrl: data.webhookUrl,
					error: error.message,
				}),
			),
			Effect.catchTag("WebhookSendError", () =>
				Effect.succeed(undefined),
			),
		);

		return { jobId, status: "completed" };
	}).pipe(
		Effect.provide(Monitor.Default),
		Effect.provide(Storage.Default),
		Effect.provide(Webhook.Default),
		Effect.provide(Logger.pretty),
		Effect.scoped,
	);

	// Fire-and-forget the job processing with error handling
	Effect.runFork(
		program.pipe(
			Effect.catchAll((error) =>
				handleError({
					jobId,
					url: data.url,
					deviceType: data.deviceType as DeviceType,
					webhookUrl: data.webhookUrl,
					createdAt,
					webhookSecret: data.webhookSecret,
					error,
				}),
			),
			Effect.provide(Storage.Default),
			Effect.provide(Webhook.Default),
			Effect.provide(Logger.pretty),
		),
	);

	// Return immediately with job ID
	return c.json(
		{
			success: true,
			data: {
				jobId,
				status: "pending",
				message: "Job created and processing asynchronously",
			},
		},
		202,
	);
});

export default observerRouter;
