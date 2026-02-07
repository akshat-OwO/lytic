import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const scores = v.object({
	performance: v.number(),
	accessibility: v.number(),
	bestPractices: v.number(),
	seo: v.number(),
});

const metricValue = v.object({
	value: v.number(),
	unit: v.string(),
	rating: v.string(),
});

const metrics = v.object({
	lcp: metricValue,
	fcp: metricValue,
	cls: metricValue,
	tbt: metricValue,
	tti: metricValue,
	si: metricValue,
});

const filmstripFrame = v.object({
	timestamp: v.number(),
	timing: v.number(),
	data: v.string(),
});

const runData = v.object({
	runNumber: v.number(),
	timestamp: v.string(),
	scores,
	metrics,
	filmstrip: v.array(filmstripFrame),
});

export default defineSchema({
	performanceJobs: defineTable({
		jobId: v.string(),
		url: v.string(),
		deviceType: v.string(),
		status: v.string(),
		createdAt: v.string(),
		completedAt: v.optional(v.string()),
		reportId: v.optional(v.string()),
		error: v.optional(
			v.object({
				code: v.string(),
				message: v.string(),
			}),
		),
	}).index("by_jobId", ["jobId"]),
	performanceReports: defineTable({
		jobId: v.string(),
		url: v.string(),
		deviceType: v.string(),
		createdAt: v.string(),
		completedAt: v.string(),
		scores,
		metrics,
		runs: v.array(runData),
	}).index("by_jobId", ["jobId"]),
});
