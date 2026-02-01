import "dotenv/config";

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
