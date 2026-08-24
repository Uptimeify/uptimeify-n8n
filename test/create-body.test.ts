import { describe, expect, it } from 'vitest';
import type { IExecuteFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { executeStatusPage } from '../nodes/Uptimeify/resources/statusPage/execute';
import { executeMonitor } from '../nodes/Uptimeify/resources/monitor/execute';

/**
 * Several resources build a create request body by spreading a shared options collection
 * alongside required top-level fields, e.g. `{ ...fields, name: topLevelName }`. When the spread
 * comes last, an option in the collection with the same name as a required field silently
 * overwrites it with the collection's (usually blank) default. That shipped once for Status Page
 * and the same shape turned up in Monitor; both now spread the collection first. These tests -
 * following the fake-context pattern from `monitor-config.test.ts` and `customer-bulk.test.ts` -
 * drive the real `executeStatusPage`/`executeMonitor` end to end through a fake `this` exposing
 * `getNode`, `getNodeParameter`, `getCredentials` and `helpers.httpRequestWithAuthentication`, and
 * assert on the recorded request body, so a reintroduction of the old ordering fails here.
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

describe('executeStatusPage - create body composition', () => {
	it('lets the top-level Name and Customer win over a colliding Additional Fields collection entry', async () => {
		const { context, calls } = createExecuteContext({
			customerId: 'cust_top_level',
			name: 'Top Level Status Page',
			additionalFields: {
				name: 'STALE-FIELDS-NAME',
				description: 'Some description',
			},
		});

		await executeStatusPage.call(context, 'create', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toMatchObject({
			name: 'Top Level Status Page',
			customerId: 'cust_top_level',
			description: 'Some description',
		});
	});
});

describe('executeMonitor - create body composition', () => {
	it('lets the top-level Name, Hostname and Port win over colliding Additional Fields entries, while non-colliding Additional Fields still arrive', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'tcp',
			customerId: 'cust_top_level',
			name: 'Top Level Monitor',
			hostname: 'top-level.example.com',
			port: 443,
			tcpOptions: {},
			additionalFields: {
				name: 'STALE-COMMON-NAME',
				hostname: 'stale.example.com',
				port: 9999,
				status: 'maintenance',
			},
		});

		await executeMonitor.call(context, 'create', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toMatchObject({
			name: 'Top Level Monitor',
			hostname: 'top-level.example.com',
			port: 443,
			customerId: 'cust_top_level',
			// Non-colliding Additional Fields options are not dead weight - they still reach the body.
			status: 'maintenance',
		});
	});
});
