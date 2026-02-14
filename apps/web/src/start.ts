import { createStart } from "@tanstack/react-start";
import { authkitMiddleware } from "@workos/authkit-tanstack-react-start";
import { serverEnv } from "./lib/env/server";

/**
 * Configure TanStack Start with AuthKit middleware.
 * The middleware runs on every server request and provides auth context.
 *
 * Import serverEnv to validate environment variables at startup.
 */
export const startInstance = createStart(() => {
	// Ensure server environment variables are validated at startup
	void serverEnv;

	return {
		// Run AuthKit middleware on every request
		requestMiddleware: [authkitMiddleware()],
	};
});
