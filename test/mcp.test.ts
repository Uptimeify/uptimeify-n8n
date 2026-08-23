import { describe, expect, it } from 'vitest';
import { parseMcpBody, readToolResult } from '../nodes/UptimeifyTools/shared/mcp';

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

	it('throws on a body it cannot read', () => {
		expect(() => parseMcpBody('not json at all')).toThrow('Unreadable MCP response');
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
});
