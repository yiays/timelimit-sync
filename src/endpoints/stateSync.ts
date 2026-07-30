import { OpenAPIRoute } from "chanfana";
import { z, } from "zod";
import { type AppContext, SecureState, SyncState } from "../types";

export class StateSync extends OpenAPIRoute {
	schema = {
		tags: ['TimeLimitApi'],
		summary: "Create or update the client's state",
    security: [
      { authKey: [] }
    ],
		request: {
			params: z.object({
				uuid: z.uuid().openapi({ description: "Target client UUID" }),
			}),
			query: z.object({
				parentMode: z.coerce.boolean().openapi({
					description: "Overrides values even if they are different from what you expected."
				}).optional().default(false),
			}),
			body: {
				content: {
					"application/json": {
						schema: SyncState.partial(),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Returns accepted if your changes were accepted, and any fields that might be different from your submission",
				content: {
					"application/json": {
						schema: z.object({
							accepted: z.boolean(),
							delta: SyncState.partial().optional(),
						}),
					},
				},
			},
			"401": {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: z.object({
							accepted: z.boolean(),
							error: z.string(),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		// Get request userAgent data
		const userAgent = c.req.header('User-Agent');
		const userAgentTest = /AutoLogoutClient\/(\d)(?: \((AutoLogout[\w-]*) ([\d.]+)\) \((.+)\))?/;
		const uaTestResult = userAgentTest.exec(userAgent);

		let clientVersion = '0.0.0';
		let os = 'unknown';
		let api_version:string, client:string = null;
		if(uaTestResult[2] === undefined)
			[ , api_version ] = uaTestResult;
		else
			[ , api_version, client, clientVersion, os ] = uaTestResult;

		// Get validated data
		const data = await this.getValidatedData<typeof this.schema>();

		// Retrieve request parameters
		const { uuid } = data.params;
		const { parentMode } = data.query;
		const authHeader = c.req.header('Authorization');
		const authKey = authHeader?.startsWith("Bearer ")
			? authHeader.split(" ")[1]
			: authHeader;

		// Retrieve the validated request body
		const { syncAuthor, ...newState} = data.body;

		const stateType = z.object(SyncState.shape);
		const secureStateType = z.object(SecureState.shape);
		
		// Retrieve existing state
		let rawState: object | string | null = await c.env.timelimit.get(uuid);
		if (rawState) {
			// State exists
			// TODO: remove this when all have been migrated
			// Upgrade state to new storage medium
			let oldState;
			if(typeof rawState === 'string')
				oldState = secureStateType.parse(JSON.parse(rawState));
			else
				oldState = secureStateType.parse(rawState);

			// Check if the client is authenticated
			if (authKey && oldState.authKeys.includes(authKey)) {
				if(parentMode || [authKey, syncAuthor].includes(oldState.syncAuthor)) {
					// Client already knows or doesn't need to know about old state
					// Update existing state
					const state = {
						...oldState,
						...newState,
						syncAuthor: authKey,
						clientOS: os
					}
					if(client == 'AutoLogout') state.clientVersion = clientVersion;

					//COMPAT: AutoLogout 1.0.0 is currently up to date, but doesn't provide a complete UA
					// This can be removed when 1.0.0 is no longer the latest release
					else if(client === null && api_version == '3') state.clientVersion = '1.0.0';

					await c.env.timelimit.put(uuid, state);

					// Inform client the changes were accepted
					return {
						accepted: true,
					}
				} else {
					// Client is not yet aware of changes made by another client
					return {
						accepted: false,
						delta: {
							dailyTimeLimit: oldState.dailyTimeLimit,
							todayTimeLimit: oldState.todayTimeLimit,
							usedTime: oldState.usedTime,
							usageDate: oldState.usageDate,
							bedtime: oldState.bedtime,
							waketime: oldState.waketime,
							syncAuthor: oldState.syncAuthor,
						}
					}
				}
			} else {
				return c.json({
					accepted: false,
					error: "Unauthorized",
				}, 401);
			}
		} else {
			// Create new state
			const parsedState = stateType.parse(newState);
			const newAuthKey = crypto.randomUUID();
			const state = {
				...parsedState,
				authKeys: [newAuthKey],
				syncAuthor: newAuthKey,
			}
			await c.env.timelimit.put(uuid, state);

			// return the created State
			return {
				accepted: true,
				delta: {
					authKey: newAuthKey,
				},
			}
		}
	}
}
