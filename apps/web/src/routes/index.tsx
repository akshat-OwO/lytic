import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return <Button>Lytic</Button>;
}
