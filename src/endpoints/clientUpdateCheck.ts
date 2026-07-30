import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

export class ClientUpdateCheck extends OpenAPIRoute {
  schema = {
    tags: ['TimeLimitApi'],
    summary: "Provide information about the latest release",
    request: {},
    responses: {
      "200": {
        description: "Returns the latest version number",
        content: {
          "application/json": {
            schema: z.object({
              version: z.string(),
            })
          }
        }
      },
    }
  };
  
  async handle(c: AppContext) {
    return c.json({
      version: "1.0.0",
    });
  }
}