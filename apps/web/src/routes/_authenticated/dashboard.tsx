import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const { user, signOut } = useAuth();

	return (
		<div>
			<h1>Dashboard</h1>
			<p>Welcome, {user?.firstName || user?.email || "there"}!</p>
			<button onClick={() => void signOut()}>Sign out</button>
		</div>
	);
}
