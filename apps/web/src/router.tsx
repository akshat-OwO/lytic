import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createRouter } from "@tanstack/react-router";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { clientEnv } from "./lib/env/client";

// Create a new router instance
export const getRouter = () => {
	const convexUrl = clientEnv.VITE_CONVEX_URL;

	const convex = new ConvexReactClient(convexUrl, {
		unsavedChangesWarning: false,
	});

	const convexQueryClient = new ConvexQueryClient(convex);

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn: convexQueryClient.hashFn(),
				queryFn: convexQueryClient.queryFn(),
			},
		},
	});
	convexQueryClient.connect(queryClient);

	const router = createRouter({
		routeTree,
		context: { queryClient, convexClient: convex, convexQueryClient },
		defaultPreload: "intent",
		scrollRestoration: true,
		defaultPreloadStaleTime: 0,
		Wrap: ({ children }) => (
			<ConvexProvider client={convexQueryClient.convexClient}>
				{children}
			</ConvexProvider>
		),
	});

	return router;
};
