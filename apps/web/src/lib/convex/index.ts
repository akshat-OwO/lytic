import { anyApi } from "convex/server";
import type { PublicApiType } from "@workspace/backend";

export const api = anyApi as unknown as PublicApiType;
