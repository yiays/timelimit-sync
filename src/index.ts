import { fromHono } from "chanfana";
import { z, } from "zod";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { StateSync } from "./endpoints/stateSync";
import { StateFetch } from "./endpoints/stateFetch";
import { ClientAuthorize } from "./endpoints/clientAuthorize";
import { ClientDeauthorize } from "./endpoints/clientDeauthorize";
import { ClientUpdateCheck } from "./endpoints/clientUpdateCheck";
import { Stats } from "./types";

// Define the stats type once globally as this will be accessed frequently
const statsType = z.object(Stats.shape);

// Type for localKV
type Env = {
  [key: string]: any;
};

// Constants
const API_VERSION = "3";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>({}).basePath("");

// Declare the API version in all responses
app.use("*", async (c, next) => {
  await next();
  c.header("X-API-Version", API_VERSION);
});

// Declare CORS
app.use("*", cors({
  origin: "http://localhost:8081",
  allowMethods: ["GET", "POST", "DELETE"],
  allowHeaders: ["Authorization", "Content-Type"]
}));

// Stats gathering
app.use("/api/*", async (c, next) => {
  await next();

  // Get the userAgent
  const userAgent = c.req.header('User-Agent');
  if(!userAgent.startsWith('AutoLogout')) return;
  // Record it in stats
  const rawStats = await c.env.timelimit.get('stats');
  const oldStats = statsType.parse(rawStats? rawStats: {});
  // Restrict updates to once daily to save writes
  let yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if(
    userAgent in oldStats.activeUserAgents && oldStats.activeUserAgents[userAgent] < yesterday
    || !(userAgent in oldStats.activeUserAgents)
  ) {
    const newStats = {
      ...oldStats,
      activeUserAgents: {
        ...oldStats.activeUserAgents,
        [userAgent]: new Date()
      }
    }
    await c.env.timelimit.put('stats', newStats);
  }
});

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
  schema: {
    info: {
      title: "Timelimit Sync API",
      description: "API for managing device usage limits in the TimeLimit apps",
      version: API_VERSION,
    }
  },
});

// Register OpenAPI endpoints
openapi.get("/api/get/:uuid", StateFetch);
openapi.get("/api/auth/:uuid", ClientAuthorize);
openapi.delete("/api/deauth/:uuid", ClientDeauthorize);
openapi.post("/api/sync/:uuid", StateSync);
openapi.get("/api/update", ClientUpdateCheck);

openapi.registry.registerComponent('securitySchemes', 'authKey', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'UUID',
  description: 'Client authKey as a bearer token',
});

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export default app;
