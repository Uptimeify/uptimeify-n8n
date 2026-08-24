import { describe, expect, it } from 'vitest';
import type { IExecuteFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { executeCustomer } from '../nodes/Uptimeify/resources/customer/execute';

/**
 * `executeCustomer` reads its inputs through `getNodeParameter` and reaches the network through
 * `uptimeifyApiRequest`, so - as with the transport and monitor-config tests - these build a fake
 * `this` exposing `getNode`, `getNodeParameter`, `getCredentials` and
 * `helpers.httpRequestWithAuthentication`, and drive the real bulk-action code through it end to
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

describe('executeCustomer - bulk', () => {
	it('sends a numeric customerIds array parsed from a well-formed comma-separated list', async () => {
		const { context, calls } = createExecuteContext({
			bulkAction: 'archive',
			bulkCustomerIds: ' 101, 102,103 ',
		});

		await executeCustomer.call(context, 'bulk', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toEqual({
			action: 'archive',
			customerIds: [101, 102, 103],
		});
	});

	it('raises naming the offending entry when one is not a positive integer', async () => {
		const { context, calls } = createExecuteContext({
			bulkAction: 'archive',
			bulkCustomerIds: '101,abc,103',
		});

		let caught: unknown;
		try {
			await executeCustomer.call(context, 'bulk', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('abc');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('raises when the entry list is empty (blank or whitespace-only input)', async () => {
		const { context, calls } = createExecuteContext({
			bulkAction: 'archive',
			bulkCustomerIds: '   ',
		});

		let caught: unknown;
		try {
			await executeCustomer.call(context, 'bulk', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('Customer IDs list is empty');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('raises naming the offending entry for "0", which is not positive', async () => {
		const { context, calls } = createExecuteContext({
			bulkAction: 'archive',
			bulkCustomerIds: '101,0,103',
		});

		let caught: unknown;
		try {
			await executeCustomer.call(context, 'bulk', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('"0"');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('raises naming the offending entry for a negative number', async () => {
		const { context, calls } = createExecuteContext({
			bulkAction: 'archive',
			bulkCustomerIds: '101,-102,103',
		});

		let caught: unknown;
		try {
			await executeCustomer.call(context, 'bulk', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('"-102"');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('raises naming the offending entry for a decimal number', async () => {
		const { context, calls } = createExecuteContext({
			bulkAction: 'archive',
			bulkCustomerIds: '101,102.5,103',
		});

		let caught: unknown;
		try {
			await executeCustomer.call(context, 'bulk', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('"102.5"');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('raises when the list has more than 200 entries, naming the count supplied', async () => {
		const tooMany = Array.from({ length: 201 }, (_, index) => index + 1).join(',');
		const { context, calls } = createExecuteContext({
			bulkAction: 'archive',
			bulkCustomerIds: tooMany,
		});

		let caught: unknown;
		try {
			await executeCustomer.call(context, 'bulk', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('201');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});
});
