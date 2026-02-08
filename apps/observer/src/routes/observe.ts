import { zValidator } from "@hono/zod-validator";
import { Effect, Logger } from "effect";
import { Hono } from "hono";
import { nanoid } from "nanoid";

import {
	BrowserLaunchError,
	LighthouseAuditError,
	Monitor,
} from "../lib/monitor.js";
import {
	type DeviceType,
	type JobId,
	type JobMetadata,
	observeSchema,
} from "../lib/schemas.js";
import { ConvexRequestError, Storage } from "../lib/storage.js";

const observerRouter = new Hono();

// Error handling helper
const handleError = (params: {
	jobId: JobId;
	url: string;
	deviceType: DeviceType;
	createdAt: string;
	error: unknown;
}) => {
	return Effect.gen(function* () {
		const storage = yield* Storage;

		const toErrorDetails = (err: unknown) => {
			if (err instanceof Error) {
				const cause =
					err.cause instanceof Error
						? err.cause.message
						: err.cause
							? String(err.cause)
							: undefined;
				return {
					message: err.message,
					stack: err.stack,
					cause,
				};
			}
			return { message: String(err) };
		};

		const { jobId, url, deviceType, createdAt } = params;
		const error = params.error as
			| BrowserLaunchError
			| LighthouseAuditError
			| ConvexRequestError
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
		} else if (error._tag === "ConvexRequestError") {
			errorCode = "STORAGE_ERROR";
			errorMessage = (error as ConvexRequestError).message;
		}

		yield* Effect.logError("Observer job failed", {
			jobId,
			url,
			deviceType,
			createdAt,
			errorTag: (error as { _tag?: string })._tag,
			errorCode,
			errorMessage,
			...toErrorDetails(params.error),
		});

		// Update job metadata to failed state
		const failedMetadata: JobMetadata = {
			jobId,
			url,
			deviceType,
			status: "failed",
			createdAt,
			completedAt: new Date().toISOString(),
			error: {
				code: errorCode,
				message: errorMessage,
			},
		};

		yield* storage
			.updateJobStatus({
				jobId,
				status: "failed",
				completedAt: failedMetadata.completedAt,
				error: failedMetadata.error,
			})
			.pipe(Effect.catchAll(() => Effect.succeed(undefined)));
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
		// Create initial job metadata
		const jobMetadata: JobMetadata = {
			jobId,
			url: data.url,
			deviceType: data.deviceType as DeviceType,
			status: "pending",
			createdAt,
		};

		// Save initial job state
		yield* storage.createJob(jobMetadata);

		yield* Effect.log("Job created", { jobId, url: data.url });

		// Update to running state
		const runningMetadata = { ...jobMetadata, status: "running" as const };
		yield* storage.updateJobStatus({
			jobId,
			status: "running",
		});

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
		yield* storage.updateJobStatus({
			jobId,
			status: "completed",
			completedAt: completedMetadata.completedAt,
			reportId: String(result.reportId),
		});

		return { jobId, status: "completed" };
	}).pipe(
		Effect.provide(Monitor.Default),
		Effect.provide(Storage.Default),
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
					createdAt,
					error,
				}),
			),
			Effect.provide(Storage.Default),
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
