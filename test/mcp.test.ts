import { describe, expect, it } from 'vitest';
import type { IExecuteFunctions, INode, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { parseMcpBody, readToolResult, TOOL_DEFINITIONS } from '../nodes/Uptimeify/shared/mcp';
import { Uptimeify } from '../nodes/Uptimeify/Uptimeify.node';

describe('parseMcpBody', () => {
	it('passes a plain JSON-RPC object through', () => {
		const rpc = { jsonrpc: '2.0', id: 1, result: { content: [] } };

		expect(parseMcpBody(rpc)).toEqual(rpc);
	});

	it('parses a JSON string', () => {
		expect(parseMcpBody('{"jsonrpc":"2.0","id":1,"result":{}}')).toEqual({
			jsonrpc: '2.0',
			id: 1,
			result: {},
		});
	});

	it('reads the last data frame of an event stream', () => {
		const stream = [
			'event: message',
			'data: {"jsonrpc":"2.0","id":1,"result":{"isError":false}}',
			'',
		].join('\n');

		expect(parseMcpBody(stream)).toEqual({
			jsonrpc: '2.0',
			id: 1,
			result: { isError: false },
		});
	});

	it('reads the last of several data frames, not the first', () => {
		// A single-frame stream would pass whether the code took the first or the last frame -
		// this proves it is genuinely the last one that wins, per the documented contract.
		const stream = [
			'event: message',
			'data: {"jsonrpc":"2.0","id":1,"result":{"isError":false,"structuredContent":{"seq":1}}}',
			'',
			'event: message',
			'data: {"jsonrpc":"2.0","id":1,"result":{"isError":false,"structuredContent":{"seq":2}}}',
			'',
			'event: message',
			'data: {"jsonrpc":"2.0","id":1,"result":{"isError":false,"structuredContent":{"seq":3}}}',
			'',
		].join('\n');

		expect(parseMcpBody(stream)).toEqual({
			jsonrpc: '2.0',
			id: 1,
			result: { isError: false, structuredContent: { seq: 3 } },
		});
	});

	it('throws on a body it cannot read', () => {
		expect(() => parseMcpBody('not json at all')).toThrow('Unreadable MCP response');
	});

	it('raises the domain message, with the parser detail appended, for a malformed bare-object body', () => {
		expect(() => parseMcpBody('{"jsonrpc": "2.0", oops}')).toThrow(/^Unreadable MCP response: /);
	});

	it('raises the domain message, with the parser detail appended, for a malformed data frame', () => {
		const stream = ['event: message', 'data: {"jsonrpc": "2.0", oops}', ''].join('\n');

		expect(() => parseMcpBody(stream)).toThrow(/^Unreadable MCP response: /);
	});
});

describe('readToolResult', () => {
	it('prefers structured content', () => {
		const rpc = {
			result: {
				isError: false,
				content: [{ type: 'text', text: '{"ok":true}' }],
				structuredContent: { ok: true },
			},
		};

		expect(readToolResult(rpc)).toEqual({
			structured: { ok: true },
			isError: false,
			text: '{"ok":true}',
		});
	});

	it('falls back to the text block when there is no structured content', () => {
		const rpc = { result: { isError: true, content: [{ type: 'text', text: 'rate limited' }] } };

		expect(readToolResult(rpc)).toEqual({ structured: {}, isError: true, text: 'rate limited' });
	});

	it('surfaces a JSON-RPC level error as an error result', () => {
		const rpc = { error: { code: -32602, message: 'Invalid params' } };

		expect(readToolResult(rpc)).toEqual({ structured: {}, isError: true, text: 'Invalid params' });
	});

	it('falls back to a fixed message for a tool-level error with no text block', () => {
		const rpc = { result: { isError: true, content: [] } };

		const result = readToolResult(rpc);

		expect(result.isError).toBe(true);
		expect(result.text).toBe('MCP tool call failed');
	});
});

describe('Uptimeify.execute - network diagnostics rate limiting', () => {
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
		httpRequest: () => Promise<never>,
		continueOnFail: boolean,
	): IExecuteFunctions {
		const node = createFakeNode();
		const params: Record<string, unknown> = {
			resource: 'networkDiagnostics',
			operation: 'website_status',
			website_status_url: 'https://example.com',
		};

		const fakeContext = {
			getInputData: (): INodeExecutionData[] => [{ json: {} }],
			getNode: () => node,
			getNodeParameter: (name: string) => params[name],
			continueOnFail: () => continueOnFail,
			helpers: { httpRequest },
		};

		return fakeContext as unknown as IExecuteFunctions;
	}

	// The error shape produced by `this.helpers.httpRequest` on a non-2xx response - verified
	// against `@n8n/backend-network`'s `invokeAxios` (which rethrows the raw Axios error) and
	// against n8n-workflow's own `NodeApiError` constructor, which reads `response.status` off an
	// `AxiosError` - carries the status at `response.status` and the JSON body at `response.data`,
	// not at `statusCode` / `response.body`.
	function rateLimitError(retryAfter?: number): { response: { status: number; data: unknown } } {
		return {
			response: {
				status: 429,
				data: retryAfter === undefined ? {} : { retryAfter },
			},
		};
	}

	it('names the seconds to wait when the endpoint returns a retryAfter', async () => {
		const context = createExecuteContext(() => Promise.reject(rateLimitError(42)), true);

		const result = await new Uptimeify().execute.call(context);

		expect(result[0][0].json.error).toBe('The rate limit was reached. Retry in 42 seconds.');
	});

	it('states the published limits when the endpoint returns no retryAfter', async () => {
		const context = createExecuteContext(() => Promise.reject(rateLimitError()), true);

		const result = await new Uptimeify().execute.call(context);

		expect(result[0][0].json.error).toBe(
			'The rate limit was reached. The limits are 120 requests per minute overall and 15 to 30 per minute per tool, counted per IP.',
		);
	});

	it('throws a NodeApiError carrying the retry hint when continueOnFail is off', async () => {
		const context = createExecuteContext(() => Promise.reject(rateLimitError(7)), false);

		let caught: unknown;
		try {
			await new Uptimeify().execute.call(context);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NodeApiError);
		expect((caught as NodeApiError).description).toBe(
			'The rate limit was reached. Retry in 7 seconds.',
		);
	});

	it('does not throw a TypeError when the rejection is not an object at all', async () => {
		const context = createExecuteContext(() => Promise.reject('socket hang up'), true);

		// A non-object rejection must fall through the 429 check cleanly (not a TypeError from
		// reading `.response` off a string) and still resolve through the continueOnFail path.
		const result = await new Uptimeify().execute.call(context);

		expect(result[0]).toHaveLength(1);
	});

	it('does not throw a TypeError when `response` is present but not an object', async () => {
		const context = createExecuteContext(() => Promise.reject({ response: 'not an object' }), true);

		const result = await new Uptimeify().execute.call(context);

		expect(result[0]).toHaveLength(1);
	});
});

describe('Uptimeify.description - network diagnostics subtitle and action', () => {
	/**
	 * The node's `subtitle` has to be a plain string literal for the n8n-nodes-base
	 * "missing subtitle" lint rule to recognize it (a runtime-built expression trips the rule), so
	 * the value-to-name lookup it embeds is written by hand instead of derived from
	 * TOOL_DEFINITIONS. This guards that the two never drift apart.
	 */
	it('embeds a value-to-name lookup in the subtitle that matches every tool in TOOL_DEFINITIONS', () => {
		const { subtitle } = new Uptimeify().description;
		const match = (subtitle as string).match(
			/^=\{\{\((\{.*?\})\)\[\$parameter\["operation"\]\] \+ ": " \+ \(/,
		);

		expect(match).not.toBeNull();

		const embeddedAll = JSON.parse((match as RegExpMatchArray)[1]) as Record<string, string>;
		const toolValues = new Set(TOOL_DEFINITIONS.map((tool) => tool.value));
		const embedded = Object.fromEntries(
			Object.entries(embeddedAll).filter(([key]) => toolValues.has(key)),
		);
		const expected = Object.fromEntries(TOOL_DEFINITIONS.map((tool) => [tool.value, tool.name]));

		expect(embedded).toEqual(expected);
	});

	it("uses each tool's action when set, falling back to its description otherwise", () => {
		const { properties } = new Uptimeify().description;
		const operationProperty = properties.find(
			(property) =>
				property.name === 'operation' &&
				(property.displayOptions?.show?.resource as string[] | undefined)?.includes(
					'networkDiagnostics',
				),
		) as INodeProperties;
		const options = operationProperty.options as Array<{ value: string; action?: string }>;

		for (const tool of TOOL_DEFINITIONS) {
			const option = options.find((entry) => entry.value === tool.value);

			expect(option?.action).toBe(tool.action ?? tool.description);
		}
	});
});
