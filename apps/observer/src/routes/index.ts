import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";

import { env } from "../lib/env.js";
import observerRouter from "./observe.js";

const appRouter = new Hono();

appRouter.use("/*", bearerAuth({ token: env.AUTH_TOKEN }));

appRouter.route("/observe", observerRouter);

export default appRouter;
