import { z } from "zod";

export const observeSchema = z.object({
	deviceType: z.union([z.literal("mobile"), z.literal("desktop")]),
	url: z.string().url(),
});
export type TObserveSchema = z.infer<typeof observeSchema>;
