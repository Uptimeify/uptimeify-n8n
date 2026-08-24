import { describe, expect, it } from 'vitest';
import type { IExecuteFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { buildConfig, executeMonitor } from '../nodes/Uptimeify/resources/monitor/execute';

/**
 * `buildConfig` reads its inputs through `getNodeParameter`, so - as with the transport tests -
 * these build a fake `this` exposing `getNodeParameter` and `getNode` and drive the real
 * validation code through it, rather than mocking the module.
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

function createContext(params: Record<string, unknown>): IExecuteFunctions {
	const node = createFakeNode();

	const fakeContext = {
		getNode: () => node,
		getNodeParameter: (name: string) => params[name],
	};

	return fakeContext as unknown as IExecuteFunctions;
}

/**
 * `executeMonitor` reaches the network through `uptimeifyApiRequest`, which - like the transport
 * tests - is driven end to end through a fake `this` exposing `getCredentials`,
 * `helpers.httpRequestWithAuthentication` and `getNodeParameter`, rather than mocking the config
 * seam out of the production code. The recorded request body is what these tests assert on.
 */
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

describe('buildConfig - dns', () => {
	it('builds expectedValues keyed by RR type for the happy path', () => {
		const context = createContext({
			rrtypes: ['A', 'MX'],
			matchMode: 'exact',
			expectedValues: {
				value: [
					{ rrtype: 'A', values: '93.184.216.34, 93.184.216.35' },
					{ rrtype: 'MX', values: 'mail.example.com' },
				],
			},
			dnsOptions: {},
		});

		const config = buildConfig(context, 'dns', ITEM_INDEX);

		expect(config).toEqual({
			rrtypes: ['A', 'MX'],
			matchMode: 'exact',
			expectedValues: {
				A: ['93.184.216.34', '93.184.216.35'],
				MX: ['mail.example.com'],
			},
			triggerOn: { resolveError: true, mismatch: true },
		});
	});

	it('respects dnsOptions overrides for triggerOn', () => {
		const context = createContext({
			rrtypes: ['A'],
			matchMode: 'contains',
			expectedValues: { value: [{ rrtype: 'A', values: '1.2.3.4' }] },
			dnsOptions: { resolveError: false, mismatch: false },
		});

		const config = buildConfig(context, 'dns', ITEM_INDEX);

		expect(config).toMatchObject({ triggerOn: { resolveError: false, mismatch: false } });
	});

	it('rejects two rows naming the same RR type instead of merging them', () => {
		const context = createContext({
			rrtypes: ['A'],
			matchMode: 'exact',
			expectedValues: {
				value: [
					{ rrtype: 'A', values: '1.1.1.1' },
					{ rrtype: 'A', values: '2.2.2.2' },
				],
			},
			dnsOptions: {},
		});

		let caught: unknown;
		try {
			buildConfig(context, 'dns', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('A');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
	});

	it('rejects a row whose value list is empty', () => {
		const context = createContext({
			rrtypes: ['TXT'],
			matchMode: 'exact',
			expectedValues: { value: [{ rrtype: 'TXT', values: '' }] },
			dnsOptions: {},
		});

		let caught: unknown;
		try {
			buildConfig(context, 'dns', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('TXT');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
	});

	it('rejects an RR type selected in rrtypes with no matching row', () => {
		const context = createContext({
			rrtypes: ['A', 'MX'],
			matchMode: 'exact',
			expectedValues: { value: [{ rrtype: 'A', values: '1.2.3.4' }] },
			dnsOptions: {},
		});

		let caught: unknown;
		try {
			buildConfig(context, 'dns', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('MX');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
	});

	it('on create, still throws for the untouched defaults (RR Types default A, no Expected Values row)', () => {
		// RR Types and Match Mode carry non-empty defaults, so they're "present" even when the
		// user never opens the DNS fields at all. Create must still require a matching row.
		const context = createContext({
			rrtypes: ['A'],
			matchMode: 'exact',
			expectedValues: {},
			dnsOptions: {},
		});

		let caught: unknown;
		try {
			buildConfig(context, 'dns', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('A');
	});

	it('on update, returns undefined without throwing when Expected Values is untouched', () => {
		// Same untouched-defaults shape as above, but for an update: renaming a DNS monitor
		// without touching any DNS field must not throw and must not build a config to send.
		const context = createContext({
			rrtypes: ['A'],
			matchMode: 'exact',
			expectedValues: {},
			dnsOptions: {},
		});

		const config = buildConfig(context, 'dns', ITEM_INDEX, 'update');

		expect(config).toBeUndefined();
	});

	it('on update, still builds and validates the config once Expected Values has a row', () => {
		const context = createContext({
			rrtypes: ['A', 'MX'],
			matchMode: 'exact',
			expectedValues: { value: [{ rrtype: 'A', values: '1.2.3.4' }] },
			dnsOptions: {},
		});

		let caught: unknown;
		try {
			buildConfig(context, 'dns', ITEM_INDEX, 'update');
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('MX');
	});
});

describe('executeMonitor - config on update', () => {
	it('sends the config for a credentialed type when its options are filled in, even with no checkMode', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'smtp',
			updateFields: {},
			monitorId: 'mon_1',
			smtpOptions: { user: 'bob', pass: 'secret' },
		});

		await executeMonitor.call(context, 'update', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toMatchObject({
			smtpConfig: { auth: { user: 'bob', pass: 'secret' } },
		});
	});

	it('sends no config when checkMode is explicitly tcp, even with options filled in', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'smtp',
			updateFields: { checkMode: 'tcp' },
			monitorId: 'mon_1',
			smtpOptions: { user: 'bob', pass: 'secret' },
		});

		await executeMonitor.call(context, 'update', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).not.toHaveProperty('smtpConfig');
	});

	it('sends no config when the type-specific options collection is untouched', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'smtp',
			// updateFields carries a real change so this exercises "no smtpConfig when smtpOptions
			// is untouched" without also tripping the empty-update-body guard - that guard's own
			// behaviour is covered separately below.
			updateFields: { name: 'renamed' },
			monitorId: 'mon_1',
			smtpOptions: {},
		});

		await executeMonitor.call(context, 'update', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).not.toHaveProperty('smtpConfig');
	});

	it('still sends dnsConfig on the DNS path, which has no checkMode at all', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'dns',
			updateFields: {},
			monitorId: 'mon_1',
			rrtypes: ['A'],
			matchMode: 'exact',
			expectedValues: { value: [{ rrtype: 'A', values: '1.2.3.4' }] },
			dnsOptions: {},
		});

		await executeMonitor.call(context, 'update', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toHaveProperty('dnsConfig');
	});

	it('sends no dnsConfig, and does not throw, when renaming a DNS monitor without touching its DNS fields', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'dns',
			updateFields: { name: 'renamed' },
			monitorId: 'mon_1',
			// RR Types and Match Mode keep their non-empty defaults even when the user never opens
			// the DNS fields; Expected Values stays genuinely empty, which is the update flow's
			// signal that the DNS matching config was not (re-)supplied.
			rrtypes: ['A'],
			matchMode: 'exact',
			expectedValues: {},
			dnsOptions: {},
		});

		await executeMonitor.call(context, 'update', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).not.toHaveProperty('dnsConfig');
	});

	it('creating a DNS monitor still requires a matching Expected Values row for every RR type', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'dns',
			additionalFields: {},
			customerId: 'cust_1',
			name: 'example',
			hostname: 'example.com',
			rrtypes: ['A'],
			matchMode: 'exact',
			expectedValues: {},
			dnsOptions: {},
		});

		await expect(executeMonitor.call(context, 'create', ITEM_INDEX)).rejects.toBeInstanceOf(
			NodeOperationError,
		);
		expect(calls).toHaveLength(0);
	});
});

describe('executeMonitor - empty update body guard', () => {
	const EMPTY_UPDATE_MESSAGE =
		'Update Fields is empty and no monitor type options were included either. Fill in at ' +
		'least one field in Update Fields, or fill in the monitor type options (for DNS, add ' +
		'an Expected Values row), or nothing would change.';

	it('raises when Update Fields is empty and no type-specific options were filled in, and sends no request', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'icmp',
			updateFields: {},
			monitorId: 'mon_1',
			icmpOptions: {},
		});

		let caught: unknown;
		try {
			await executeMonitor.call(context, 'update', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toBe(EMPTY_UPDATE_MESSAGE);
		expect(calls).toHaveLength(0);
	});

	it('raises for a DNS monitor with RR Types supplied but no Expected Values rows and empty Update Fields, and sends no request', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'dns',
			updateFields: {},
			monitorId: 'mon_1',
			// RR Types was changed from its default, but with no Expected Values row buildConfig
			// deliberately returns undefined (see buildConfig's dns branch) - so the final body is
			// empty even though the user did touch a DNS field.
			rrtypes: ['A', 'MX'],
			matchMode: 'contains',
			expectedValues: {},
			dnsOptions: {},
		});

		let caught: unknown;
		try {
			await executeMonitor.call(context, 'update', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toBe(EMPTY_UPDATE_MESSAGE);
		expect(calls).toHaveLength(0);
	});

	it('still sends the request, body untouched, when Update Fields carries a real change', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'icmp',
			updateFields: { name: 'renamed' },
			monitorId: 'mon_1',
			icmpOptions: {},
		});

		await executeMonitor.call(context, 'update', ITEM_INDEX);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toEqual({ name: 'renamed' });
	});
});
