import { mutation, query } from "./_generated/server";
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

export const createJob = mutation({
	args: {
		jobId: v.string(),
		url: v.string(),
		deviceType: v.string(),
		createdAt: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("performanceJobs", {
			jobId: args.jobId,
			url: args.url,
			deviceType: args.deviceType,
			status: "pending",
			createdAt: args.createdAt,
		});
		return args.jobId;
	},
});

export const updateJobStatus = mutation({
	args: {
		jobId: v.string(),
		status: v.string(),
		completedAt: v.optional(v.string()),
		reportId: v.optional(v.string()),
		error: v.optional(
			v.object({
				code: v.string(),
				message: v.string(),
			}),
		),
	},
	handler: async (ctx, args) => {
		const job = await ctx.db
			.query("performanceJobs")
			.withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
			.unique();

		if (!job) {
			throw new Error(`Job ${args.jobId} not found`);
		}

		const update: {
			status: string;
			completedAt?: string;
			reportId?: string;
			error?: { code: string; message: string };
		} = {
			status: args.status,
		};

		if (args.completedAt !== undefined) {
			update.completedAt = args.completedAt;
		}
		if (args.reportId !== undefined) {
			update.reportId = args.reportId;
		}
		if (args.error !== undefined) {
			update.error = args.error;
		}

		await ctx.db.patch(job._id, update);
		return args.jobId;
	},
});

export const saveReport = mutation({
	args: {
		jobId: v.string(),
		url: v.string(),
		deviceType: v.string(),
		createdAt: v.string(),
		completedAt: v.string(),
		scores,
		metrics,
		runs: v.array(runData),
	},
	handler: async (ctx, args) => {
		const reportId = await ctx.db.insert("performanceReports", args);
		return reportId;
	},
});

export const getJobById = query({
	args: { jobId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("performanceJobs")
			.withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
			.unique();
	},
});

export const getReportByJobId = query({
	args: { jobId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("performanceReports")
			.withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
			.unique();
	},
});
