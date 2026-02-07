import { z } from "zod";

// Branded JobId type (using Zod brand)
export const JobId = z.string().brand("@Observer/JobId");
export type JobId = z.infer<typeof JobId>;

// Device type
export const DeviceType = z.enum(["mobile", "desktop"]);
export type DeviceType = z.infer<typeof DeviceType>;

// Job status
export const JobStatus = z.enum(["pending", "running", "completed", "failed"]);
export type JobStatus = z.infer<typeof JobStatus>;

// Score type (0-1)
export const Score = z.number().min(0).max(1);
export type Score = z.infer<typeof Score>;

// Metric rating
export const MetricRating = z.enum(["good", "needs-improvement", "poor"]);
export type MetricRating = z.infer<typeof MetricRating>;

// Filmstrip frame
export const FilmstripFrame = z.object({
	timestamp: z.number(),
	timing: z.number(),
	data: z.string(),
});
export type FilmstripFrame = z.infer<typeof FilmstripFrame>;

// Scores
export const Scores = z.object({
	performance: Score,
	accessibility: Score,
	bestPractices: Score,
	seo: Score,
});
export type Scores = z.infer<typeof Scores>;

// Metric with value and rating
export const MetricValue = z.object({
	value: z.number(),
	unit: z.enum(["ms", "unitless"]),
	rating: MetricRating,
});
export type MetricValue = z.infer<typeof MetricValue>;

// Metrics
export const Metrics = z.object({
	lcp: MetricValue,
	fcp: MetricValue,
	cls: MetricValue,
	tbt: MetricValue,
	tti: MetricValue,
	si: MetricValue,
});
export type Metrics = z.infer<typeof Metrics>;

// Individual run
export const LighthouseRunData = z.object({
	runNumber: z.number().min(1),
	timestamp: z.string(),
	scores: Scores,
	metrics: Metrics,
	filmstrip: z.array(FilmstripFrame),
});
export type LighthouseRunData = z.infer<typeof LighthouseRunData>;

// Job metadata
export const JobMetadata = z.object({
	jobId: JobId,
	url: z.string(),
	deviceType: DeviceType,
	status: JobStatus,
	createdAt: z.string(),
	completedAt: z.string().optional(),
	error: z
		.object({
			code: z.string(),
			message: z.string(),
		})
		.optional(),
});
export type JobMetadata = z.infer<typeof JobMetadata>;

// Aggregated report
export const AggregatedReport = z.object({
	jobId: JobId,
	url: z.string(),
	deviceType: DeviceType,
	createdAt: z.string(),
	completedAt: z.string(),
	scores: Scores,
	metrics: Metrics,
	runs: z.array(LighthouseRunData),
});
export type AggregatedReport = z.infer<typeof AggregatedReport>;

// Request validation schema (Hono)
export const observeSchema = z.object({
	url: z.string().url(),
	deviceType: z.enum(["mobile", "desktop"]),
});

export type TObserveSchema = z.infer<typeof observeSchema>;
