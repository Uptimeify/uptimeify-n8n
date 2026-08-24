import { describe, expect, it } from 'vitest';
import type { IDataObject, IHookFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { UptimeifyTrigger } from '../nodes/UptimeifyTrigger/UptimeifyTrigger.node';

/**
 * The Customer/Website/Source Channel scope fields moved from plain number fields to resource
 * locators (see AGENTS.md cleanup wave) so the trigger offers the same picker experience as the
 * Uptimeify action node. `create()` has to unwrap and `Number()` them before they reach the
 * `POST /api/notification-channels` body - these drive the real `create()` hook through a fake
 * `this` that mimics n8n's `extractValue` behaviour for a resource locator parameter, and assert
 * the recorded request body carries plain numbers, in both "From List" and "By ID" modes.
 */
function createFakeNode(): INode {
	return {
		id: '1',
		name: 'Uptimeify Trigger',
		typeVersion: 1,
		type: 'n8n-nodes-uptimeify.uptimeifyTrigger',
		position: [0, 0],
		parameters: {},
	};
}

function createHookContext(params: Record<string, unknown>): {
	context: IHookFunctions;
	calls: IHttpRequestOptions[];
} {
	const node = createFakeNode();
	const staticData: IDataObject = {};
	const calls: IHttpRequestOptions[] = [];

	const fakeContext = {
		getNode: () => node,
		getNodeWebhookUrl: () => 'https://n8n.example/webhook/abc',
		getWorkflow: () => ({ name: 'Test Workflow' }),
		getWorkflowStaticData: () => staticData,
		getCredentials: async () => ({ apiToken: 'wsm_test', baseUrl: 'https://uptimeify.test' }),
		// Mirrors real n8n: `extractValue: true` on a resourceLocator parameter returns its
		// `value` (a resource locator inside a collection would need unwrapping by hand instead,
		// but these three are top-level parameters, so this matches production behaviour).
		getNodeParameter: (name: string, _fallback?: unknown, options?: { extractValue?: boolean }) => {
			const value = params[name];
			if (options?.extractValue && typeof value === 'object' && value !== null) {
				return (value as { value: unknown }).value;
			}
			return value;
		},
		helpers: {
			httpRequestWithAuthentication: async (
				_credentialsType: string,
				requestOptions: IHttpRequestOptions,
			) => {
				calls.push(requestOptions);
				return { id: 99 };
			},
		},
	};

	return { context: fakeContext as unknown as IHookFunctions, calls };
}

describe('UptimeifyTrigger.create - scope picker unwrapping', () => {
	it('sends plain numeric ids when the pickers are in "From List" mode', async () => {
		const { context, calls } = createHookContext({
			scope: 'website',
			customerId: { mode: 'list', value: 42, cachedResultName: 'Acme' },
			websiteId: { mode: 'list', value: 17, cachedResultName: 'acme.example.com' },
			sourceChannelId: { mode: 'list', value: 5, cachedResultName: 'Parent Channel' },
		});

		await new UptimeifyTrigger().webhookMethods.default.create.call(context);

		expect(calls).toHaveLength(1);
		const body = calls[0].body as IDataObject;

		expect(body.customerId).toBe(42);
		expect(body.websiteId).toBe(17);
		expect(body.sourceChannelId).toBe(5);
		expect(typeof body.customerId).toBe('number');
		expect(typeof body.websiteId).toBe('number');
		expect(typeof body.sourceChannelId).toBe('number');
	});

	it('sends plain numeric ids when the pickers are in "By ID" mode', async () => {
		const { context, calls } = createHookContext({
			scope: 'website',
			customerId: { mode: 'id', value: '42' },
			websiteId: { mode: 'id', value: '17' },
			sourceChannelId: { mode: 'id', value: '5' },
		});

		await new UptimeifyTrigger().webhookMethods.default.create.call(context);

		expect(calls).toHaveLength(1);
		const body = calls[0].body as IDataObject;

		expect(body.customerId).toBe(42);
		expect(body.websiteId).toBe(17);
		expect(body.sourceChannelId).toBe(5);
		expect(typeof body.customerId).toBe('number');
		expect(typeof body.websiteId).toBe('number');
		expect(typeof body.sourceChannelId).toBe('number');
	});

	it('omits websiteId and sourceChannelId, and sends a numeric customerId, for the customer scope', async () => {
		const { context, calls } = createHookContext({
			scope: 'customer',
			customerId: { mode: 'list', value: 42, cachedResultName: 'Acme' },
		});

		await new UptimeifyTrigger().webhookMethods.default.create.call(context);

		const body = calls[0].body as IDataObject;

		expect(body.customerId).toBe(42);
		expect(body.websiteId).toBeUndefined();
		expect(body.sourceChannelId).toBeUndefined();
	});

	// A `NodeOperationError` here - rather than a `Number()`-produced `NaN`/`0`/`null` slipping into
	// the request body - is what stands between an empty or malformed picker and silently widening
	// the channel's scope (see AGENTS.md item 1). Both cases below must throw before any request is
	// made.
	it('rejects an empty "By ID" selection instead of sending a request', async () => {
		const { context, calls } = createHookContext({
			scope: 'customer',
			customerId: { mode: 'id', value: '' },
		});

		await expect(
			new UptimeifyTrigger().webhookMethods.default.create.call(context),
		).rejects.toThrow(/Customer ".*" is not a positive integer/);
		expect(calls).toHaveLength(0);
	});

	it('rejects a pasted UUID instead of coercing it with Number() and sending a request', async () => {
		const { context, calls } = createHookContext({
			scope: 'customer',
			customerId: { mode: 'id', value: '059e1469-0f05-4c93-bd4d-89c45bb2afd9' },
		});

		await expect(
			new UptimeifyTrigger().webhookMethods.default.create.call(context),
		).rejects.toThrow(/Customer "059e1469-0f05-4c93-bd4d-89c45bb2afd9" is not a positive integer/);
		expect(calls).toHaveLength(0);
	});
});
