import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { createRouter } from "@tanstack/react-router";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import {
	AuthKitProvider,
	useAccessToken,
	useAuth,
} from "@workos/authkit-tanstack-react-start/client";
import { useCallback, useMemo } from "react";

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
				gcTime: 5000,
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
		defaultErrorComponent: (err) => <p>{err.error.stack}</p>,
		defaultNotFoundComponent: () => <p>not found</p>,
		Wrap: ({ children }) => (
			<AuthKitProvider>
				<ConvexProviderWithAuth
					client={convexQueryClient.convexClient}
					useAuth={useAuthFromWorkOS}
				>
					{children}
				</ConvexProviderWithAuth>
			</AuthKitProvider>
		),
	});

	setupRouterSsrQueryIntegration({ router, queryClient });

	return router;
};

function useAuthFromWorkOS() {
	const { loading, user } = useAuth();
	const { getAccessToken, refresh } = useAccessToken();

	const fetchAccessToken = useCallback(
		async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
			// WorkOS hooks handle user checks internally
			if (forceRefreshToken) {
				return (await refresh()) ?? null;
			}

			return (await getAccessToken()) ?? null;
		},
		[refresh, getAccessToken],
	);

	return useMemo(
		() => ({
			isLoading: loading,
			isAuthenticated: !!user,
			fetchAccessToken,
		}),
		[loading, user, fetchAccessToken],
	);
}
