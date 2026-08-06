import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context;

// Common core values all states should have
export const BaseState = z.object({
	hashedPassword: z.string()
		.openapi({ example: "$2a$11$..." })
		.regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/, { message: "Invalid bcrypt hash" }),
	dailyTimeLimit: z.number().int()
		.openapi({ example: 7200})
		.gte(-1).lt(86400),
	todayTimeLimit: z.number().int()
		.openapi({ example: 7200 })
		.gte(-1).lt(86400),
	usedTime: z.number().int()
		.openapi({ example: 0 })
		.gte(-1).lt(86400).optional(),
	usageDate: z.string()
		.openapi({ example: "2024-01-15 +0:00" })
		.regex(/^\d{4}\-\d{2}\-\d{2}( [+-]\d{1,2}:\d{2})?$/, { message: "Invalid date format, expected YYYY-MM-DD ∓hh:mm" }),
	usage: z.record(z.string().regex(/^\d{4}\-\d{2}\-\d{2}/, {message: "Invalid date format, expected YYYY-MM-DD"}),
		z.object({
			totalUsage: z.number().int().optional(),
			entries: z.record(z.string(), z.object({
				names: z.array(z.string()),
				usedTime: z.number().int()
			})).optional()
		}))
		.openapi({example: {"2024-01-15": {totalTime: 200,'edge.exe': {names: ['YouTube', 'Google', 'Bunnies - Google Images'], usedTime: 150}}}})
		.optional(),
	bedtime: z.string()
		.openapi({ example: "22:00:00" })
		.regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, { message: "Invalid time format, expected hh:mm" }),
	waketime: z.string()
		.openapi({ example: "22:00:00" })
		.regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, { message: "Invalid time format, expected hh:mm" }),
	syncAuthor: z.uuid(),
	clientVersion: z.string().default('0.0.0'),
	clientOS: z.string().default('unknown'),
})

// States when syncing with the client
export const SyncState = z.object({
	...BaseState.shape,
	hashedPassword: BaseState.shape.hashedPassword.optional(),
	syncAuthor: BaseState.shape.syncAuthor.optional().nullable()
});

// States including security information that is kept on the server
export const SecureState = z.object({
	...BaseState.shape,
	authKeys: z.array(z.uuid()).default([]),
});

export const Stats = z.object({
	activeUserAgents: z.record(z.string(), z.coerce.date()).default({})
});