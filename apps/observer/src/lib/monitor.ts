import { URL } from "node:url";

import { Data, Effect } from "effect";
import type { Result } from "lighthouse";
import lighthouse, { desktopConfig } from "lighthouse";
import puppeteer, { type Browser } from "puppeteer";

import {
	type DeviceType,
	type JobId,
	type LighthouseRunData,
	type Metrics,
	type Scores,
} from "./schemas.js";
import { Storage } from "./storage.js";

// Tagged errors
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

// Filmstrip frame type
interface FilmstripItem {
	timestamp: number;
	timing: number;
	data: string;
}

// Extract filmstrip frames from Lighthouse result
const extractFilmstrip = (lhr: Result): Array<FilmstripItem> => {
	const thumbnails = lhr.audits["screenshot-thumbnails"];
	if (!thumbnails?.details || thumbnails.details.type !== "filmstrip") {
		return [];
	}

	const items = thumbnails.details.items as unknown as Array<FilmstripItem>;
	if (!Array.isArray(items)) {
		return [];
	}

	return items.map((item) => ({
		timestamp: item.timestamp,
		timing: item.timing,
		data: item.data,
	}));
};

// Get score from category
const getScore = (
	lhr: Result,
	category: "performance" | "accessibility" | "best-practices" | "seo",
): number => {
	const score = lhr.categories[category]?.score;
	return typeof score === "number" ? score : 0;
};

// Get audit value and rating
type MetricRating = "good" | "needs-improvement" | "poor";

const getMetric = (
	lhr: Result,
	auditId: string,
): { value: number; unit: "ms" | "unitless"; rating: MetricRating } => {
	const audit = lhr.audits[auditId];
	const value = audit?.numericValue ?? 0;
	const unit = auditId === "cumulative-layout-shift" ? "unitless" : "ms";

	// Determine rating based on score if available
	let rating: MetricRating = "good";
	if (audit?.score === null || audit?.score === undefined) {
		rating = "poor";
	} else {
		const score = audit.score;
		if (score >= 0.9) {
			rating = "good";
		} else if (score >= 0.5) {
			rating = "needs-improvement";
		} else {
			rating = "poor";
		}
	}

	return { value, unit, rating };
};

// Run single Lighthouse audit
const runSingleAudit = Effect.fn("Monitor.runSingleAudit")(function* (
	browser: Browser,
	data: { url: string; deviceType: DeviceType },
) {
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
					output: ["json"],
					logLevel: "silent",
				},
				data.deviceType === "desktop" ? desktopConfig : undefined,
			),
		catch: (error) =>
			new LighthouseAuditError({
				message: "Failed to run Lighthouse audit",
				cause: error instanceof Error ? error.message : String(error),
			}),
	});

	if (!runnerResult) {
		return yield* new LighthouseAuditError({
			message: "Lighthouse returned no results",
		});
	}

	return runnerResult;
});

// Aggregate scores from multiple runs
const aggregateScores = (runs: Array<Result>): Scores => {
	const performanceScores = runs.map((r) => getScore(r, "performance"));
	const accessibilityScores = runs.map((r) => getScore(r, "accessibility"));
	const bestPracticesScores = runs.map((r) => getScore(r, "best-practices"));
	const seoScores = runs.map((r) => getScore(r, "seo"));

	const average = (arr: number[]) =>
		arr.reduce((sum, val) => sum + val, 0) / arr.length;

	return {
		performance: average(performanceScores),
		accessibility: average(accessibilityScores),
		bestPractices: average(bestPracticesScores),
		seo: average(seoScores),
	};
};

// Aggregate metrics from multiple runs
const aggregateMetrics = (runs: Array<Result>): Metrics => {
	const average = (arr: number[]) =>
		arr.reduce((sum, val) => sum + val, 0) / arr.length;

	const lcpValues = runs.map((r) => getMetric(r, "largest-contentful-paint"));
	const fcpValues = runs.map((r) => getMetric(r, "first-contentful-paint"));
	const clsValues = runs.map((r) => getMetric(r, "cumulative-layout-shift"));
	const tbtValues = runs.map((r) => getMetric(r, "total-blocking-time"));
	const ttiValues = runs.map((r) => getMetric(r, "interactive"));
	const siValues = runs.map((r) => getMetric(r, "speed-index"));

	// Calculate rating based on averaged value
	const getRating = (
		value: number,
		good: number,
		poor: number,
	): MetricRating => {
		if (value <= good) return "good";
		if (value <= poor) return "needs-improvement";
		return "poor";
	};

	return {
		lcp: {
			value: average(lcpValues.map((m) => m.value)),
			unit: "ms",
			rating: getRating(
				average(lcpValues.map((m) => m.value)),
				2500,
				4000,
			),
		},
		fcp: {
			value: average(fcpValues.map((m) => m.value)),
			unit: "ms",
			rating: getRating(
				average(fcpValues.map((m) => m.value)),
				1800,
				3000,
			),
		},
		cls: {
			value: average(clsValues.map((m) => m.value)),
			unit: "unitless",
			rating: getRating(
				average(clsValues.map((m) => m.value)),
				0.1,
				0.25,
			),
		},
		tbt: {
			value: average(tbtValues.map((m) => m.value)),
			unit: "ms",
			rating: getRating(average(tbtValues.map((m) => m.value)), 200, 600),
		},
		tti: {
			value: average(ttiValues.map((m) => m.value)),
			unit: "ms",
			rating: getRating(
				average(ttiValues.map((m) => m.value)),
				3800,
				7300,
			),
		},
		si: {
			value: average(siValues.map((m) => m.value)),
			unit: "ms",
			rating: getRating(
				average(siValues.map((m) => m.value)),
				3400,
				5800,
			),
		},
	};
};

export class Monitor extends Effect.Service<Monitor>()("observer/Monitor", {
	accessors: true,
	dependencies: [Storage.Default],
	effect: Effect.gen(function* () {
		const storage = yield* Storage;

		// Execute multiple Lighthouse runs and aggregate results
		const execute = Effect.fn("Monitor.execute")(function* (data: {
			url: string;
			deviceType: DeviceType;
			jobId: JobId;
			runCount?: number;
		}) {
			const { url, deviceType, jobId } = data;
			const runCount = data.runCount ?? 3;

			yield* Effect.log("Starting web performance audit", {
				url,
				deviceType,
				runCount,
				jobId,
			});

			// Launch browser once for all runs
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
				(br) =>
					Effect.sync(() => {
						void br.close();
					}),
			);

			// Run Lighthouse multiple times
			const runResults: Array<{
				runNumber: number;
				lhr: Result;
				report: string | string[];
			}> = [];

			for (let i = 1; i <= runCount; i++) {
				yield* Effect.log(`Starting run ${i} of ${runCount}`, {
					jobId,
				});

				const result = yield* runSingleAudit(browser, {
					url,
					deviceType,
				});

				runResults.push({
					runNumber: i,
					lhr: result.lhr,
					report: result.report,
				});

				// Brief pause between runs
				if (i < runCount) {
					yield* Effect.sleep("2 seconds");
				}
			}

			// Aggregate results
			yield* Effect.log("Aggregating results", { jobId });
			const lhResults = runResults.map((r) => r.lhr);
			const aggregatedScores = aggregateScores(lhResults);
			const aggregatedMetrics = aggregateMetrics(lhResults);

			// Process individual runs (data extracted, not uploaded separately)
			const runsData: Array<LighthouseRunData> = [];

			for (const run of runResults) {
				const runNumber = run.runNumber;
				const timestamp = new Date().toISOString();

				// Extract filmstrip
				const filmstrip = extractFilmstrip(run.lhr);

				// Build run data (no individual uploads - all data is in report.json)
				runsData.push({
					runNumber,
					timestamp,
					scores: {
						performance: getScore(run.lhr, "performance"),
						accessibility: getScore(run.lhr, "accessibility"),
						bestPractices: getScore(run.lhr, "best-practices"),
						seo: getScore(run.lhr, "seo"),
					},
					metrics: {
						lcp: getMetric(run.lhr, "largest-contentful-paint"),
						fcp: getMetric(run.lhr, "first-contentful-paint"),
						cls: getMetric(run.lhr, "cumulative-layout-shift"),
						tbt: getMetric(run.lhr, "total-blocking-time"),
						tti: getMetric(run.lhr, "interactive"),
						si: getMetric(run.lhr, "speed-index"),
					},
					filmstrip,
				});
			}

			// Upload aggregated report only
			const aggregatedReport = {
				jobId,
				url,
				deviceType,
				createdAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				scores: aggregatedScores,
				metrics: aggregatedMetrics,
				runs: runsData,
			};

			const reportId = yield* storage.saveReport(aggregatedReport);

			yield* Effect.log("Audit completed successfully", {
				jobId,
				url,
				deviceType,
				scores: aggregatedScores,
			});

			return {
				reportId,
				aggregatedReport,
			};
		});

		return { execute };
	}),
}) {}
