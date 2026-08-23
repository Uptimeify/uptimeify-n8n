import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { IDataObject, IHookFunctions, INode, IWebhookFunctions } from 'n8n-workflow';
import { UptimeifyTrigger } from '../nodes/UptimeifyTrigger/UptimeifyTrigger.node';

const SECRET = 'top-secret';

function sign(raw: Buffer | string, secret: string): string {
	return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

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

interface WebhookContextOptions {
	/** The exact bytes the request arrived with. */
	rawBody: Buffer;
	/** What n8n's own body parser produced from those bytes. */
	body: IDataObject;
	headers: Record<string, string>;
	verifySignature: boolean;
	events: string[];
	secret?: string;
}

function createWebhookContext(options: WebhookContextOptions): {
	context: IWebhookFunctions;
	statusCalls: number[];
	sendCalls: unknown[];
} {
	const node = createFakeNode();
	const staticData: IDataObject = options.secret === undefined ? {} : { secret: options.secret };
	const statusCalls: number[] = [];
	const sendCalls: unknown[] = [];

	const responseObject = {
		status(code: number) {
			statusCalls.push(code);
			return responseObject;
		},
		send(payload: unknown) {
			sendCalls.push(payload);
			return responseObject;
		},
	};

	const fakeContext = {
		getNode: () => node,
		getBodyData: () => options.body,
		getHeaderData: () => options.headers,
		getNodeParameter: (name: string) => {
			if (name === 'verifySignature') return options.verifySignature;
			if (name === 'events') return options.events;
			throw new Error(`unexpected parameter requested: ${name}`);
		},
		getWorkflowStaticData: () => staticData,
		getRequestObject: () => ({ rawBody: options.rawBody }),
		getResponseObject: () => responseObject,
	};

	return { context: fakeContext as unknown as IWebhookFunctions, statusCalls, sendCalls };
}

/**
 * A header bag that throws if the signature header is ever read. Used to prove that
 * `verifySignature: false` skips the header entirely rather than merely ignoring a bad result.
 */
function headersWithGuardedSignature(headers: Record<string, string>): Record<string, string> {
	return new Proxy(headers, {
		get(target, prop, receiver) {
			if (prop === 'x-webhook-signature') {
				throw new Error('the signature header must not be consulted when verification is off');
			}
			return Reflect.get(target, prop, receiver) as unknown;
		},
	});
}

describe('UptimeifyTrigger.webhook - signature verification', () => {
	it('accepts a signature computed over the raw bytes, whitespace and all', async () => {
		// The raw bytes carry formatting a re-serialization of the parsed body would drop.
		const rawBody = Buffer.from('{"type": "alert",   "incident_id": 8094}');
		const body = JSON.parse(rawBody.toString('utf8')) as IDataObject;
		const signature = sign(rawBody, SECRET);

		const { context } = createWebhookContext({
			rawBody,
			body,
			headers: {
				'x-webhook-signature': signature,
				'x-webhook-event': 'alert',
				'x-webhook-attempt': '1',
				'x-webhook-timestamp': '1700000000',
			},
			verifySignature: true,
			events: [],
			secret: SECRET,
		});

		const result = await new UptimeifyTrigger().webhook.call(context);

		expect(result.workflowData).toBeDefined();
		expect(result.workflowData?.[0]?.[0]?.json).toMatchObject({
			type: 'alert',
			incident_id: 8094,
		});
	});

	it('rejects a valid signature made over a differently-formatted rendering of the same JSON', async () => {
		const rawBody = Buffer.from('{"type":"alert","incident_id":8094}');
		const body = JSON.parse(rawBody.toString('utf8')) as IDataObject;
		// Signed over a pretty-printed rendering, not the bytes that actually arrived.
		const signature = sign(JSON.stringify(body, null, 2), SECRET);

		const { context, statusCalls, sendCalls } = createWebhookContext({
			rawBody,
			body,
			headers: { 'x-webhook-signature': signature },
			verifySignature: true,
			events: [],
			secret: SECRET,
		});

		const result = await new UptimeifyTrigger().webhook.call(context);

		expect(result.workflowData).toBeUndefined();
		expect(statusCalls).toEqual([401]);
		expect(sendCalls).toEqual(['Invalid signature']);
	});

	it('rejects a request with no signature header', async () => {
		const rawBody = Buffer.from('{"type":"alert","incident_id":8094}');
		const body = JSON.parse(rawBody.toString('utf8')) as IDataObject;

		const { context, statusCalls, sendCalls } = createWebhookContext({
			rawBody,
			body,
			headers: {},
			verifySignature: true,
			events: [],
			secret: SECRET,
		});

		const result = await new UptimeifyTrigger().webhook.call(context);

		expect(result.workflowData).toBeUndefined();
		expect(statusCalls).toEqual([401]);
		expect(sendCalls).toEqual(['Invalid signature']);
	});

	it('passes the request through without consulting the header when verification is off', async () => {
		const rawBody = Buffer.from('{"type":"alert","incident_id":8094}');
		const body = JSON.parse(rawBody.toString('utf8')) as IDataObject;

		const { context } = createWebhookContext({
			rawBody,
			body,
			headers: headersWithGuardedSignature({
				'x-webhook-event': 'alert',
				'x-webhook-attempt': '1',
				'x-webhook-timestamp': '1700000000',
			}),
			verifySignature: false,
			events: [],
			// No secret stored either - verification being off must not need it.
		});

		const result = await new UptimeifyTrigger().webhook.call(context);

		expect(result.workflowData).toBeDefined();
		expect(result.workflowData?.[0]?.[0]?.json).toMatchObject({ type: 'alert' });
	});
});

describe('UptimeifyTrigger.webhook - event filter', () => {
	it('acknowledges without workflow data when the event type was not selected', async () => {
		const rawBody = Buffer.from('{"type":"alert","incident_id":8094}');
		const body = JSON.parse(rawBody.toString('utf8')) as IDataObject;

		const { context, statusCalls } = createWebhookContext({
			rawBody,
			body,
			headers: {},
			verifySignature: false,
			events: ['recovery'],
		});

		const result = await new UptimeifyTrigger().webhook.call(context);

		expect(result.workflowData).toBeUndefined();
		expect(statusCalls).toEqual([]);
	});

	it('passes every event type through when the filter is empty', async () => {
		const rawBody = Buffer.from('{"type":"warning","incident_id":8094}');
		const body = JSON.parse(rawBody.toString('utf8')) as IDataObject;

		const { context } = createWebhookContext({
			rawBody,
			body,
			headers: {},
			verifySignature: false,
			events: [],
		});

		const result = await new UptimeifyTrigger().webhook.call(context);

		expect(result.workflowData).toBeDefined();
		expect(result.workflowData?.[0]?.[0]?.json).toMatchObject({ type: 'warning' });
	});
});

describe('UptimeifyTrigger.webhook - emitted item', () => {
	it('carries the parsed body plus _headers, and never the signing secret', async () => {
		const rawBody = Buffer.from('{"type":"alert","incident_id":8094}');
		const body = JSON.parse(rawBody.toString('utf8')) as IDataObject;
		const signature = sign(rawBody, SECRET);

		const { context } = createWebhookContext({
			rawBody,
			body,
			headers: {
				'x-webhook-signature': signature,
				'x-webhook-event': 'alert',
				'x-webhook-attempt': '2',
				'x-webhook-timestamp': '1700000000',
			},
			verifySignature: true,
			events: [],
			secret: SECRET,
		});

		const result = await new UptimeifyTrigger().webhook.call(context);
		const json = result.workflowData?.[0]?.[0]?.json;

		expect(json).toMatchObject({
			type: 'alert',
			incident_id: 8094,
			_headers: { event: 'alert', attempt: '2', timestamp: '1700000000' },
		});
		expect(JSON.stringify(result)).not.toContain(SECRET);
	});
});

describe('UptimeifyTrigger delete - stale channel handling', () => {
	function createHookContext(
		handler: () => never,
		staticData: IDataObject,
	): { context: IHookFunctions } {
		const node = createFakeNode();

		const fakeContext = {
			getNode: () => node,
			getCredentials: async () => ({ apiToken: 'wsm_test', baseUrl: 'https://uptimeify.test' }),
			getWorkflowStaticData: () => staticData,
			helpers: {
				httpRequestWithAuthentication: async () => handler(),
			},
		};

		return { context: fakeContext as unknown as IHookFunctions };
	}

	it('treats a 404 as success and clears the stale channel ID and secret', async () => {
		const staticData: IDataObject = { channelId: 42, secret: 'shh' };
		const { context } = createHookContext(() => {
			throw { message: 'Request failed with status code 404', response: { status: 404 } };
		}, staticData);

		const result = await new UptimeifyTrigger().webhookMethods.default.delete.call(context);

		expect(result).toBe(true);
		expect(staticData.channelId).toBeUndefined();
		expect(staticData.secret).toBeUndefined();
	});

	it('propagates a 403 and leaves the static data untouched', async () => {
		const staticData: IDataObject = { channelId: 42, secret: 'shh' };
		const { context } = createHookContext(() => {
			throw { message: 'Request failed with status code 403', response: { status: 403 } };
		}, staticData);

		await expect(
			new UptimeifyTrigger().webhookMethods.default.delete.call(context),
		).rejects.toThrow();

		expect(staticData.channelId).toBe(42);
		expect(staticData.secret).toBe('shh');
	});
});
