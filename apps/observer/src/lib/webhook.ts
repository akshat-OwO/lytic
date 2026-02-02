import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";

import { Data, Effect, Schedule } from "effect";

import { env } from "./env.js";
import {
	type DeviceType,
	type JobId,
	type JobStatus,
	type Metrics,
	type Scores,
	type WebhookPayload,
} from "./schemas.js";

// Tagged errors
export class WebhookSendError extends Data.TaggedError("WebhookSendError")<{
	webhookUrl: string;
	jobId: JobId;
	attempt: number;
	message: string;
	cause?: string;
}> {}

export class WebhookSignatureError extends Data.TaggedError(
	"WebhookSignatureError",
)<{
	webhookUrl: string;
	jobId: JobId;
	message: string;
	cause?: string;
}> {}

export class WebhookUrlNotAllowedError extends Data.TaggedError(
	"WebhookUrlNotAllowedError",
)<{
	webhookUrl: string;
	jobId: JobId;
	message: string;
}> {}

// Create webhook payload
export const createWebhookPayload = (params: {
	jobId: JobId;
	status: JobStatus;
	url: string;
	deviceType: DeviceType;
	reportKey?: string;
	summary?: { scores: Scores; metrics: Metrics };
	error?: { code: string; message: string };
}): WebhookPayload => {
	return {
		jobId: params.jobId,
		status: params.status,
		url: params.url,
		deviceType: params.deviceType,
		reportKey: params.reportKey,
		summary: params.summary,
		error: params.error,
	};
};

// Sign payload with HMAC-SHA256
const signPayload = (
	payload: string,
	secret: string,
): Effect.Effect<string, WebhookSignatureError, never> => {
	return Effect.try({
		try: () => {
			const hmac = createHmac("sha256", secret);
			hmac.update(payload);
			return hmac.digest("hex");
		},
		catch: (error) =>
			new WebhookSignatureError({
				webhookUrl: "",
				jobId: "" as JobId,
				message: "Failed to sign payload",
				cause: error instanceof Error ? error.message : String(error),
			}),
	});
};

const isPrivateIp = (ip: string): boolean => {
	if (!net.isIP(ip)) return true;

	// IPv4 checks
	if (net.isIPv4(ip)) {
		const parts = ip.split(".");
		if (parts.length !== 4) return true;
		const a = Number(parts[0]);
		const b = Number(parts[1]);
		if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
		if (a === 10) return true;
		if (a === 127) return true;
		if (a === 0) return true;
		if (a === 169 && b === 254) return true;
		if (a === 192 && b === 168) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a >= 224) return true; // multicast + reserved
		return false;
	}

	// IPv6 checks (rough but safe)
	const normalized = ip.toLowerCase();
	if (normalized === "::1") return true;
	if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
	if (normalized.startsWith("fe80")) return true; // link-local
	if (normalized === "::") return true;
	return false;
};

const parseAllowedHosts = (value?: string): Set<string> | undefined => {
	if (!value) return undefined;
	const hosts = value
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	return hosts.length ? new Set(hosts) : undefined;
};

const validateWebhookUrl = Effect.fn("Webhook.validateWebhookUrl")(function* (
	webhookUrl: string,
	jobId: JobId,
) {
	let url: URL;
	try {
		url = new URL(webhookUrl);
	} catch {
		return yield* Effect.fail(
			new WebhookUrlNotAllowedError({
				webhookUrl,
				jobId,
				message: "Invalid webhookUrl",
			}),
		);
	}

	if (url.protocol !== "https:") {
		return yield* Effect.fail(
			new WebhookUrlNotAllowedError({
				webhookUrl,
				jobId,
				message: "webhookUrl must use https",
			}),
		);
	}

	if (!url.hostname) {
		return yield* Effect.fail(
			new WebhookUrlNotAllowedError({
				webhookUrl,
				jobId,
				message: "webhookUrl hostname is required",
			}),
		);
	}

	// Allowlist check (optional)
	const allow = parseAllowedHosts(env.WEBHOOK_ALLOWED_HOSTS);
	if (allow && !allow.has(url.hostname.toLowerCase())) {
		return yield* Effect.fail(
			new WebhookUrlNotAllowedError({
				webhookUrl,
				jobId,
				message: "webhookUrl host is not in allowlist",
			}),
		);
	}

	// Block IP-literals and private IPs
	if (net.isIP(url.hostname)) {
		return yield* Effect.fail(
			new WebhookUrlNotAllowedError({
				webhookUrl,
				jobId,
				message: "IP literal webhookUrl hosts are not allowed",
			}),
		);
	}

	const resolved = yield* Effect.tryPromise({
		try: () => lookup(url.hostname, { all: true, verbatim: true }),
		catch: (error) =>
			new WebhookUrlNotAllowedError({
				webhookUrl,
				jobId,
				message:
					error instanceof Error
						? `Failed to resolve webhook host: ${error.message}`
						: "Failed to resolve webhook host",
			}),
	});

	for (const addr of resolved) {
		if (isPrivateIp(addr.address)) {
			return yield* Effect.fail(
				new WebhookUrlNotAllowedError({
					webhookUrl,
					jobId,
					message: "webhookUrl resolves to a private IP",
				}),
			);
		}
	}

	return url;
});

// Webhook service
export class Webhook extends Effect.Service<Webhook>()("observer/Webhook", {
	accessors: true,
	sync: () => {
		const maxAttempts = env.WEBHOOK_RETRY_MAX_ATTEMPTS;
		const baseDelayMs = env.WEBHOOK_RETRY_BASE_DELAY_MS;

		// Send webhook with retry logic
		const send = Effect.fn("Webhook.send")(function* (
			webhookUrl: string,
			payload: WebhookPayload,
			webhookSecret?: string,
		) {
			yield* validateWebhookUrl(webhookUrl, payload.jobId).pipe(
				Effect.mapError(
					(err) =>
						new WebhookSendError({
							webhookUrl,
							jobId: payload.jobId,
							attempt: 1,
							message: err.message,
						}),
				),
			);

			const payloadJson = JSON.stringify(payload);

			// Generate signature if secret provided
			const signature = webhookSecret
				? yield* signPayload(payloadJson, webhookSecret).pipe(
						Effect.catchTag("WebhookSignatureError", (err) =>
							Effect.fail(
								new WebhookSendError({
									webhookUrl,
									jobId: payload.jobId,
									attempt: 1,
									message: err.message,
									cause: err.cause,
								}),
							),
						),
					)
				: undefined;

			// Prepare headers
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			if (signature) {
				headers["X-Observer-Signature"] = signature;
			}

			// Define the send operation with retry
			const sendOnce = Effect.fn("Webhook.sendOnce")(function* (
				attempt: number,
			) {
				yield* Effect.log("Sending webhook", {
					webhookUrl,
					jobId: payload.jobId,
					attempt,
				});

				const response = yield* Effect.tryPromise({
					try: () =>
						fetch(webhookUrl, {
							method: "POST",
							headers,
							body: payloadJson,
						}),
					catch: (error) =>
						new WebhookSendError({
							webhookUrl,
							jobId: payload.jobId,
							attempt,
							message: "Network error sending webhook",
							cause:
								error instanceof Error
									? error.message
									: String(error),
						}),
				});

				if (!response.ok) {
					return yield* new WebhookSendError({
						webhookUrl,
						jobId: payload.jobId,
						attempt,
						message: `Webhook returned ${response.status} ${response.statusText}`,
					});
				}

				yield* Effect.log("Webhook sent successfully", {
					webhookUrl,
					jobId: payload.jobId,
					attempt,
					status: response.status,
				});

				return response;
			});

			// Retry policy: exponential backoff starting at baseDelayMs
			const retryPolicy = Schedule.recurs(maxAttempts - 1).pipe(
				Schedule.intersect(Schedule.exponential(baseDelayMs, 2)),
			);

			// Execute with retry
			return yield* sendOnce(1).pipe(
				Effect.retry({
					schedule: retryPolicy,
					while: (error) => error._tag === "WebhookSendError",
				}),
				Effect.tapError((error) =>
					Effect.logError("Webhook failed after all retries", {
						webhookUrl,
						jobId: payload.jobId,
						error: error.message,
						cause: error.cause,
					}),
				),
			);
		});

		return { send, createPayload: createWebhookPayload };
	},
}) {}
