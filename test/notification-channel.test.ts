import { describe, expect, it } from 'vitest';
import type { IExecuteFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { executeNotificationChannel } from '../nodes/Uptimeify/resources/notificationChannel/execute';

/**
 * `parseJsonParameter` reads the `Config` field and reaches the network through
 * `uptimeifyApiRequest`, so - as with `customer-bulk.test.ts` and `maintenance-window.test.ts` -
 * these build a fake `this` exposing `getNode`, `getNodeParameter`, `getCredentials` and
 * `helpers.httpRequestWithAuthentication`, and drive the real create/test/update code through it
 * end to end. The recorded request body is what these tests assert on.
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

describe('executeNotificationChannel - Config parsing', () => {
	it('raises a NodeOperationError naming Config when create receives malformed JSON', async () => {
		const { context, calls } = createExecuteContext({
			additionalFields: {},
			type: 'webhook',
			name: 'Broken Webhook',
			config: '{ "url": ',
		});

		let caught: unknown;
		try {
			await executeNotificationChannel.call(context, 'create', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('Config');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('sends the parsed object when create receives valid JSON', async () => {
		const { context, calls } = createExecuteContext({
			additionalFields: {},
			type: 'webhook',
			name: 'Working Webhook',
			config: '{ "url": "https://example.com/hook" }',
		});

		await executeNotificationChannel.call(context, 'create', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toMatchObject({ config: { url: 'https://example.com/hook' } });
	});

	it('raises a NodeOperationError naming Config when test receives malformed JSON', async () => {
		const { context, calls } = createExecuteContext({
			testType: 'webhook',
			config: 'not json',
		});

		let caught: unknown;
		try {
			await executeNotificationChannel.call(context, 'test', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('Config');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('raises a NodeOperationError naming Config when update receives malformed JSON', async () => {
		const { context, calls } = createExecuteContext({
			channelId: 'chan_123',
			updateFields: { config: '{ bad json' },
		});

		let caught: unknown;
		try {
			await executeNotificationChannel.call(context, 'update', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('Config');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
		expect(calls).toHaveLength(0);
	});

	it('sends the parsed object when update receives valid JSON', async () => {
		const { context, calls } = createExecuteContext({
			channelId: 'chan_123',
			updateFields: { config: '{ "secret": "abc" }' },
		});

		await executeNotificationChannel.call(context, 'update', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toMatchObject({ config: { secret: 'abc' } });
	});
});
