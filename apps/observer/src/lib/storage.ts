import type { PublicApiType } from "@workspace/backend";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { Data, Effect } from "effect";

import { env } from "./env.js";

// Tagged errors
export class ConvexRequestError extends Data.TaggedError("ConvexRequestError")<{
	operation: string;
	message: string;
	cause?: string;
}> {}

const api = anyApi as unknown as PublicApiType;

export class Storage extends Effect.Service<Storage>()("observer/Storage", {
	accessors: true,
	sync: () => {
		const client = new ConvexHttpClient(env.CONVEX_URL);
		const getErrorDetails = (error: unknown): string => {
			if (!(error instanceof Error)) return String(error);
			// Node's fetch wraps the real error in .cause
			const rootCause =
				error.cause instanceof Error
					? error.cause.message
					: error.cause
						? String(error.cause)
						: undefined;
			return rootCause
				? `${error.message} -> ${rootCause}`
				: error.message;
		};

		const logConvexError = (operation: string, error: unknown) =>
			Effect.logError("Convex request failed", {
				operation,
				url: env.CONVEX_URL,
				cause: getErrorDetails(error),
			});

		const createJob = Effect.fn("Storage.createJob")(function* (params: {
			jobId: string;
			url: string;
			deviceType: string;
			createdAt: string;
		}) {
			return yield* Effect.tryPromise({
				try: () =>
					client.mutation(api.performance.createJob, {
						jobId: params.jobId,
						url: params.url,
						deviceType: params.deviceType,
						createdAt: params.createdAt,
					}),
				catch: (error) => {
					Effect.runFork(logConvexError("createJob", error));
					return new ConvexRequestError({
						operation: "createJob",
						message: "Failed to create job",
						cause: getErrorDetails(error),
					});
				},
			});
		});

		const updateJobStatus = Effect.fn("Storage.updateJobStatus")(
			function* (params: {
				jobId: string;
				status: string;
				completedAt?: string;
				reportId?: string;
				error?: { code: string; message: string };
			}) {
				return yield* Effect.tryPromise({
					try: () =>
						client.mutation(api.performance.updateJobStatus, {
							jobId: params.jobId,
							status: params.status,
							completedAt: params.completedAt,
							reportId: params.reportId,
							error: params.error,
						}),
					catch: (error) => {
						Effect.runFork(
							logConvexError("updateJobStatus", error),
						);
						return new ConvexRequestError({
							operation: "updateJobStatus",
							message: "Failed to update job status",
							cause: getErrorDetails(error),
						});
					},
				});
			},
		);

		const saveReport = Effect.fn("Storage.saveReport")(function* (params: {
			jobId: string;
			url: string;
			deviceType: string;
			createdAt: string;
			completedAt: string;
			scores: {
				performance: number;
				accessibility: number;
				bestPractices: number;
				seo: number;
			};
			metrics: {
				lcp: { value: number; unit: string; rating: string };
				fcp: { value: number; unit: string; rating: string };
				cls: { value: number; unit: string; rating: string };
				tbt: { value: number; unit: string; rating: string };
				tti: { value: number; unit: string; rating: string };
				si: { value: number; unit: string; rating: string };
			};
			runs: Array<{
				runNumber: number;
				timestamp: string;
				scores: {
					performance: number;
					accessibility: number;
					bestPractices: number;
					seo: number;
				};
				metrics: {
					lcp: { value: number; unit: string; rating: string };
					fcp: { value: number; unit: string; rating: string };
					cls: { value: number; unit: string; rating: string };
					tbt: { value: number; unit: string; rating: string };
					tti: { value: number; unit: string; rating: string };
					si: { value: number; unit: string; rating: string };
				};
				filmstrip: Array<{
					timestamp: number;
					timing: number;
					data: string;
				}>;
			}>;
		}) {
			return yield* Effect.tryPromise({
				try: () => client.mutation(api.performance.saveReport, params),
				catch: (error) => {
					Effect.runFork(logConvexError("saveReport", error));
					return new ConvexRequestError({
						operation: "saveReport",
						message: "Failed to save report",
						cause: getErrorDetails(error),
					});
				},
			});
		});

		return { createJob, updateJobStatus, saveReport };
	},
}) {}
