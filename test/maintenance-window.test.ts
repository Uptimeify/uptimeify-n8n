import { describe, expect, it } from 'vitest';
import type { IExecuteFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { executeMaintenanceWindow } from '../nodes/Uptimeify/resources/maintenanceWindow/execute';

/**
 * `buildWindowBody` reads its inputs through `getNodeParameter` and reaches the network through
 * `uptimeifyApiRequest`, so - as with `customer-bulk.test.ts` and `create-body.test.ts` - these
 * build a fake `this` exposing `getNode`, `getNodeParameter`, `getCredentials` and
 * `helpers.httpRequestWithAuthentication`, and drive the real create-body code through it end to
 * end. The recorded request body is what these tests assert on.
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

function createExecuteContext(params: Record<string, unknown>): {
	context: IExecuteFunctions;
	calls: IHttpRequestOptions[];
} {
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
				return {};
			},
		},
	};

	return { context: fakeContext as unknown as IExecuteFunctions, calls };
}

const ITEM_INDEX = 0;

const BASE_PARAMS = {
	additionalFields: {},
	name: 'Weekend Maintenance',
	startTime: '2026-08-22T00:00:00.000Z',
	endTime: '2026-08-23T00:00:00.000Z',
};

describe('executeMaintenanceWindow - tags targeting', () => {
	it('sends a numeric tagIds array parsed from a well-formed comma-separated list', async () => {
		const { context, calls } = createExecuteContext({
			...BASE_PARAMS,
			targeting: 'tags',
			tagIds: ' 7, 12,13 ',
		});

		await executeMaintenanceWindow.call(context, 'create', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toMatchObject({ tagIds: [7, 12, 13] });
	});

	it('raises naming the offending entry when a tag ID is not a positive integer', async () => {
		const { context, calls } = createExecuteContext({
			...BASE_PARAMS,
			targeting: 'tags',
			tagIds: '7,abc,13',
		});

		let caught: unknown;
		try {
			await executeMaintenanceWindow.call(context, 'create', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('abc');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('raises when the tags field is blank', async () => {
		const { context, calls } = createExecuteContext({
			...BASE_PARAMS,
			targeting: 'tags',
			tagIds: '   ',
		});

		let caught: unknown;
		try {
			await executeMaintenanceWindow.call(context, 'create', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});
});

describe('executeMaintenanceWindow - targets (monitors) targeting', () => {
	it('raises when no target rows were added', async () => {
		const { context, calls } = createExecuteContext({
			...BASE_PARAMS,
			targeting: 'targets',
			targets: {},
		});

		let caught: unknown;
		try {
			await executeMaintenanceWindow.call(context, 'create', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('raises when a target row has a blank ID', async () => {
		const { context, calls } = createExecuteContext({
			...BASE_PARAMS,
			targeting: 'targets',
			targets: {
				target: [
					{ type: 'monitor', id: 'mon_123' },
					{ type: 'customer_domain', id: '' },
				],
			},
		});

		let caught: unknown;
		try {
			await executeMaintenanceWindow.call(context, 'create', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('customer_domain');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('sends the targets array unchanged for a well-formed list', async () => {
		const { context, calls } = createExecuteContext({
			...BASE_PARAMS,
			targeting: 'targets',
			targets: {
				target: [
					{ type: 'monitor', id: 'mon_123' },
					{ type: 'customer_domain', id: 'dom_456' },
				],
			},
		});

		await executeMaintenanceWindow.call(context, 'create', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toMatchObject({
			targets: [
				{ type: 'monitor', id: 'mon_123' },
				{ type: 'customer_domain', id: 'dom_456' },
			],
		});
	});
});

describe('executeMaintenanceWindow - update with an empty body', () => {
	it('raises naming Update Fields instead of sending a PATCH that changes nothing', async () => {
		const { context, calls } = createExecuteContext({
			maintenanceWindowId: 'win_1',
			updateFields: {},
		});

		let caught: unknown;
		try {
			await executeMaintenanceWindow.call(context, 'update', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('Update Fields');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('sends the PATCH when Update Fields has at least one field set', async () => {
		const { context, calls } = createExecuteContext({
			maintenanceWindowId: 'win_1',
			updateFields: { name: 'Renamed window' },
		});

		await executeMaintenanceWindow.call(context, 'update', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toEqual({ name: 'Renamed window' });
	});
});
