import "dotenv/config";

import dns from "node:dns";

// Force IPv4 for DNS lookups — Node 22's fetch (undici) can prefer IPv6
// which times out when the IPv6 route is unreachable on many networks.
const _origLookup = dns.lookup.bind(dns);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(dns as any).lookup = function (hostname: string, ...rest: any[]) {
	if (typeof rest[0] === "function") {
		return _origLookup(hostname, { family: 4 }, rest[0]);
	}
	const opts =
		typeof rest[0] === "number" ? { family: 4 } : { ...rest[0], family: 4 };
	return _origLookup(hostname, opts, rest[1]);
};

import { serve } from "@hono/node-server";
import chalk from "chalk";
import { Hono } from "hono";

import appRouter from "./routes/index.js";

const app = new Hono();

app.get("/heartbeat", (c) => {
	return c.text("Alive!");
}).route("/", appRouter);

serve(
	{
		fetch: app.fetch,
		port: 8080,
	},
	(info) => {
		console.log(
			`\n ${chalk.green(chalk.bold("Observer"))}\n ${chalk.green(chalk.bold("➜"))} ${chalk.white("Local:")}\t ${chalk.cyan(`http://localhost:${chalk.bold(info.port)}`)}`,
		);
	},
);
