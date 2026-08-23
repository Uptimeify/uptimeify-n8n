import { describe, expect, it } from 'vitest';
import type { IExecuteFunctions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { buildConfig } from '../nodes/Uptimeify/resources/monitor/execute';

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
});
