import fs from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";

import { Data, Effect } from "effect";
import lighthouse, { desktopConfig } from "lighthouse";
import puppeteer from "puppeteer";

import { TObserveSchema } from "./schemas.js";

export class BrowserLaunchError extends Data.TaggedError("BrowserLaunchError")<{
	message: string;
	cause?: string;
}> {}

export class LighthouseAuditError extends Data.TaggedError(
	"LighthouseAuditError",
)<{
	message: string;
	cause?: string;
}> {}

export class ReportSaveError extends Data.TaggedError("ReportSaveError")<{
	message: string;
	cause?: string;
}> {}

export class Monitor extends Effect.Service<Monitor>()("observer/Monitor", {
	accessors: true,
	sync: () => {
		const execute = Effect.fn("Monitor.execute")(function* (
			data: TObserveSchema,
		) {
			yield* Effect.log("Starting web performance audit", {
				url: data.url,
				deviceType: data.deviceType,
			});

			const browser = yield* Effect.acquireRelease(
				Effect.tryPromise({
					try: () =>
						puppeteer.launch({
							headless: true,
							args: ["--no-sandbox", "--disable-setuid-sandbox"],
						}),
					catch: (error) =>
						new BrowserLaunchError({
							message: "Failed to launch browser",
							cause:
								error instanceof Error
									? error.message
									: String(error),
						}),
				}),
				(browser) =>
					Effect.sync(() => {
						void browser.close();
					}),
			);

			const port = yield* Effect.sync(() => {
				const wsEndpoint = browser.wsEndpoint();
				return new URL(wsEndpoint).port;
			});

			yield* Effect.log("Running Lighthouse audit", {
				url: data.url,
				deviceType: data.deviceType,
			});

			const runnerResult = yield* Effect.tryPromise({
				try: () =>
					lighthouse(
						data.url,
						{
							port: Number(port),
							output: ["json", "html"],
							logLevel: "error",
						},
						data.deviceType === "desktop"
							? desktopConfig
							: undefined,
					),
				catch: (error) =>
					new LighthouseAuditError({
						message: "Failed to run Lighthouse audit",
						cause:
							error instanceof Error
								? error.message
								: String(error),
					}),
			});

			if (!runnerResult) {
				return yield* new LighthouseAuditError({
					message: "Lighthouse returned no results",
				});
			}

			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const urlHostname = new URL(data.url).hostname.replace(
				/[^a-zA-Z0-9-]/g,
				"_",
			);
			const baseFilename = `${timestamp}-${urlHostname}-${data.deviceType}`;
			const reportsDir = path.join(process.cwd(), "assets", "reports");
			const jsonFilepath = path.join(reportsDir, `${baseFilename}.json`);
			const htmlFilepath = path.join(reportsDir, `${baseFilename}.html`);

			yield* Effect.log("Saving reports", {
				jsonFilepath,
				htmlFilepath,
			});

			yield* Effect.tryPromise({
				try: async () => {
					await fs.mkdir(reportsDir, { recursive: true });
					await fs.writeFile(
						jsonFilepath,
						JSON.stringify(runnerResult.lhr, null, 2),
						"utf-8",
					);
					if (Array.isArray(runnerResult.report)) {
						await fs.writeFile(
							htmlFilepath,
							runnerResult.report[1] ?? "",
							"utf-8",
						);
					} else if (typeof runnerResult.report === "string") {
						await fs.writeFile(
							htmlFilepath,
							runnerResult.report,
							"utf-8",
						);
					}
				},
				catch: (error) =>
					new ReportSaveError({
						message: "Failed to save reports",
						cause:
							error instanceof Error
								? error.message
								: String(error),
					}),
			});

			yield* Effect.log("Audit completed successfully", {
				url: data.url,
				deviceType: data.deviceType,
				jsonFilepath,
				htmlFilepath,
				score: runnerResult.lhr.categories.performance?.score,
			});

			return {
				jsonFilepath,
				htmlFilepath,
				lighthouseResult: runnerResult.lhr,
			};
		});

		return { execute };
	},
}) {}
