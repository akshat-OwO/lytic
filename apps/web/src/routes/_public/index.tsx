import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { Authenticated, Unauthenticated } from "convex/react";

const getSignInUrlAction = createServerFn({ method: "GET" }).handler(
	async () => {
		return await getSignInUrl();
	},
);

export const Route = createFileRoute("/_public/")({
	component: RouteComponent,
});

function RouteComponent() {
	const handleSignIn = async () => {
		const signInUrl = await getSignInUrlAction();
		window.location.href = signInUrl;
	};

	return (
		<>
			<Authenticated>
				<div>
					<h1>Hello there!</h1>
					<p>You are signed in.</p>
				</div>
			</Authenticated>
			<Unauthenticated>
				<button onClick={() => void handleSignIn()}>Sign in</button>
			</Unauthenticated>
		</>
	);
}
