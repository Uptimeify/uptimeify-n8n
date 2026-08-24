import { describe, expect, it } from 'vitest';
import type { IExecuteFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { executeImOnCall } from '../nodes/Uptimeify/resources/imOnCall/execute';
import { executeImTeam } from '../nodes/Uptimeify/resources/imTeam/execute';
import { executeImSchedule } from '../nodes/Uptimeify/resources/imSchedule/execute';

/**
 * The On-Call resource's three list operations (now split across the On-Call, Team and Schedule
 * resources - see AGENTS.md cleanup wave) used to ignore Return All / Limit entirely, always
 * fetching everything the bare-array endpoint returned. These drive the real executors end to end
 * through a fake `this`, following the pattern from `create-body.test.ts`, and assert on the
 * length of the returned array to prove the limit is actually honoured.
 */
function createFakeNode(): INode {
	return {
		id: '1',
		name: 'Uptimeify',
		typeVersion: 1,
		type: 'n8n-nodes-uptimeify.uptimeify',
		position: [0, 0],
		parameters: {},
	};
}

function createExecuteContext(
	params: Record<string, unknown>,
	responseItems: unknown[],
): { context: IExecuteFunctions; calls: IHttpRequestOptions[] } {
	const node = createFakeNode();
	const calls: IHttpRequestOptions[] = [];

	const fakeContext = {
		getNode: () => node,
		getNodeParameter: (name: string) => params[name],
		getCredentials: async () => ({ apiToken: 'wsm_test', baseUrl: 'https://uptimeify.test' }),
		helpers: {
			httpRequestWithAuthentication: async (
				_credentialsType: string,
				options: IHttpRequestOptions,
			) => {
				calls.push(options);
				return responseItems;
			},
		},
	};

	return { context: fakeContext as unknown as IExecuteFunctions, calls };
}

const ITEM_INDEX = 0;
const FIVE_ROWS = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

describe('executeImOnCall - getAll pagination', () => {
	it('caps the result at limit when Return All is off', async () => {
		const { context, calls } = createExecuteContext({ returnAll: false, limit: 2 }, FIVE_ROWS);

		const result = await executeImOnCall.call(context, 'getAll', ITEM_INDEX);

		expect(result).toHaveLength(2);
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe('https://uptimeify.test/api/im/on-call');
	});

	it('returns every row when Return All is on', async () => {
		const { context } = createExecuteContext({ returnAll: true }, FIVE_ROWS);

		const result = await executeImOnCall.call(context, 'getAll', ITEM_INDEX);

		expect(result).toHaveLength(5);
	});
});

describe('executeImTeam - getAll pagination', () => {
	it('caps the result at limit when Return All is off', async () => {
		const { context, calls } = createExecuteContext({ returnAll: false, limit: 3 }, FIVE_ROWS);

		const result = await executeImTeam.call(context, 'getAll', ITEM_INDEX);

		expect(result).toHaveLength(3);
		expect(calls[0].url).toBe('https://uptimeify.test/api/im/teams');
	});

	it('returns every row when Return All is on', async () => {
		const { context } = createExecuteContext({ returnAll: true }, FIVE_ROWS);

		const result = await executeImTeam.call(context, 'getAll', ITEM_INDEX);

		expect(result).toHaveLength(5);
	});
});

describe('executeImSchedule - getAll pagination', () => {
	it('caps the result at limit when Return All is off', async () => {
		const { context, calls } = createExecuteContext({ returnAll: false, limit: 1 }, FIVE_ROWS);

		const result = await executeImSchedule.call(context, 'getAll', ITEM_INDEX);

		expect(result).toHaveLength(1);
		expect(calls[0].url).toBe('https://uptimeify.test/api/im/schedules');
	});

	it('returns every row when Return All is on', async () => {
		const { context } = createExecuteContext({ returnAll: true }, FIVE_ROWS);

		const result = await executeImSchedule.call(context, 'getAll', ITEM_INDEX);

		expect(result).toHaveLength(5);
	});
});
