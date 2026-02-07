import { type FunctionReference, anyApi } from "convex/server";
import { type GenericId as Id } from "convex/values";

export const api: PublicApiType = anyApi as unknown as PublicApiType;
export const internal: InternalApiType = anyApi as unknown as InternalApiType;

export type PublicApiType = {
  performance: {
    createJob: FunctionReference<
      "mutation",
      "public",
      { createdAt: string; deviceType: string; jobId: string; url: string },
      any
    >;
    updateJobStatus: FunctionReference<
      "mutation",
      "public",
      {
        completedAt?: string;
        error?: { code: string; message: string };
        jobId: string;
        reportId?: string;
        status: string;
      },
      any
    >;
    saveReport: FunctionReference<
      "mutation",
      "public",
      {
        completedAt: string;
        createdAt: string;
        deviceType: string;
        jobId: string;
        metrics: {
          cls: { rating: string; unit: string; value: number };
          fcp: { rating: string; unit: string; value: number };
          lcp: { rating: string; unit: string; value: number };
          si: { rating: string; unit: string; value: number };
          tbt: { rating: string; unit: string; value: number };
          tti: { rating: string; unit: string; value: number };
        };
        runs: Array<{
          filmstrip: Array<{ data: string; timestamp: number; timing: number }>;
          metrics: {
            cls: { rating: string; unit: string; value: number };
            fcp: { rating: string; unit: string; value: number };
            lcp: { rating: string; unit: string; value: number };
            si: { rating: string; unit: string; value: number };
            tbt: { rating: string; unit: string; value: number };
            tti: { rating: string; unit: string; value: number };
          };
          runNumber: number;
          scores: {
            accessibility: number;
            bestPractices: number;
            performance: number;
            seo: number;
          };
          timestamp: string;
        }>;
        scores: {
          accessibility: number;
          bestPractices: number;
          performance: number;
          seo: number;
        };
        url: string;
      },
      any
    >;
    getJobById: FunctionReference<"query", "public", { jobId: string }, any>;
    getReportByJobId: FunctionReference<
      "query",
      "public",
      { jobId: string },
      any
    >;
  };
};
export type InternalApiType = {};
