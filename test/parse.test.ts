import { describe, expect, it } from 'vitest';
import type { IExecuteFunctions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { parseJsonParameter } from '../nodes/Uptimeify/shared/parse';

/**
 * Tests for the shared `parseJsonParameter` helper, which guards against
 * malformed user-supplied JSON strings by wrapping parse errors in a
 * `NodeOperationError` that names the field instead of surfacing a raw `SyntaxError`.
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

function createExecuteContext(): IExecuteFunctions {
	const node = createFakeNode();

	return {
		getNode: () => node,
		getNodeParameter: () => undefined,
		getCredentials: async () => ({ apiToken: 'wsm_test', baseUrl: 'https://uptimeify.test' }),
		helpers: {
			httpRequestWithAuthentication: async () => ({}),
		},
	} as unknown as IExecuteFunctions;
}

const ITEM_INDEX = 0;

describe('parseJsonParameter', () => {
	it('parses valid JSON string into an object', () => {
		const context = createExecuteContext();
		const json = '{ "url": "https://example.com/hook", "secret": "abc123" }';

		const result = parseJsonParameter(context, json, 'Config', ITEM_INDEX);

		expect(result).toEqual({ url: 'https://example.com/hook', secret: 'abc123' });
	});

	it('passes through an already-parsed object unchanged', () => {
		const context = createExecuteContext();
		const obj = { url: 'https://example.com', port: 443 };

		const result = parseJsonParameter(context, obj, 'Payload', ITEM_INDEX);

		expect(result).toBe(obj);
	});

	it('short-circuits null and undefined to empty object', () => {
		const context = createExecuteContext();

		const resultNull = parseJsonParameter(context, null, 'Config', ITEM_INDEX);
		const resultUndefined = parseJsonParameter(context, undefined, 'Payload', ITEM_INDEX);

		expect(resultNull).toEqual({});
		expect(resultUndefined).toEqual({});
	});

	it('raises a NodeOperationError naming the field when JSON is malformed', () => {
		const context = createExecuteContext();
		const badJson = '{ "url": ';

		let caught: unknown;
		try {
			parseJsonParameter(context, badJson, 'Config', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		expect((caught as NodeOperationError).message).toContain('Config');
		expect((caught as NodeOperationError).message).toContain('is not valid JSON');
		expect((caught as NodeOperationError).context.itemIndex).toBe(ITEM_INDEX);
	});

	it('includes the parser error message in the NodeOperationError', () => {
		const context = createExecuteContext();
		const badJson = 'not json';

		let caught: unknown;
		try {
			parseJsonParameter(context, badJson, 'Payload', ITEM_INDEX);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeOperationError);
		const message = (caught as NodeOperationError).message;
		expect(message).toContain('Payload');
		expect(message).toContain('is not valid JSON');
		// The exact parser message may vary, but it should be present
		expect(message.length).toBeGreaterThan('Payload is not valid JSON: '.length);
	});

	it('uses the supplied fieldName in error messages', () => {
		const context = createExecuteContext();

		let caught1: unknown;
		try {
			parseJsonParameter(context, '{ bad', 'MyField', 0);
		} catch (error) {
			caught1 = error;
		}

		let caught2: unknown;
		try {
			parseJsonParameter(context, '{ bad', 'AnotherField', 0);
		} catch (error) {
			caught2 = error;
		}

		const msg1 = (caught1 as NodeOperationError).message;
		const msg2 = (caught2 as NodeOperationError).message;

		expect(msg1).toContain('MyField');
		expect(msg2).toContain('AnotherField');
	});

	it('preserves itemIndex in the error context', () => {
		const context = createExecuteContext();

		let caught: unknown;
		try {
			parseJsonParameter(context, '[ bad ]', 'TestField', 42);
		} catch (error) {
			caught = error;
		}

		expect((caught as NodeOperationError).context.itemIndex).toBe(42);
	});
});
