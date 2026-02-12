import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";

export const authStateFn = createServerFn().handler(async () => {
	const { isAuthenticated, userId, getToken } = await auth();
	const token = await getToken({ template: "convex" });

	return {
		userId: userId,
		token,
		isAuthenticated,
	};
});
