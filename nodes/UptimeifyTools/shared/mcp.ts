import type { IDataObject } from 'n8n-workflow';

/** `/mcp` answers only on the canonical host; a custom domain returns 404 before anything else. */
export const MCP_ENDPOINT = 'https://uptimeify.io/mcp';

type ToolArgument = {
	name: string;
	displayName: string;
	type: 'string' | 'number';
	required: boolean;
	placeholder: string;
};

export type ToolDefinition = {
	value: string;
	name: string;
	description: string;
	args: ToolArgument[];
};

// These are plain data-table rows, not n8n node parameter definitions — they happen to share the
// `name`/`displayName`/`type` shape n8n-nodes-base pattern-matches on, but the real INodeProperties
// built from them in UptimeifyTools.node.ts do set a `default`, so the rule's concern is already met.
/* eslint-disable n8n-nodes-base/node-param-default-missing -- see comment above; false positive on data, not a node parameter */

const host = (required = true): ToolArgument => ({
	name: 'host',
	displayName: 'Host',
	type: 'string',
	required,
	placeholder: 'e.g. example.com',
});

const domain: ToolArgument = {
	name: 'domain',
	displayName: 'Domain',
	type: 'string',
	required: true,
	placeholder: 'e.g. example.com',
};

const url: ToolArgument = {
	name: 'url',
	displayName: 'URL',
	type: 'string',
	required: true,
	placeholder: 'e.g. https://example.com',
};

const ip: ToolArgument = {
	name: 'ip',
	displayName: 'IP Address',
	type: 'string',
	required: true,
	placeholder: 'e.g. 203.0.113.10',
};

const query: ToolArgument = {
	name: 'query',
	displayName: 'Query',
	type: 'string',
	required: true,
	placeholder: 'e.g. 203.0.113.10',
};

const port = (required: boolean): ToolArgument => ({
	name: 'port',
	displayName: 'Port',
	type: 'number',
	required,
	placeholder: 'e.g. 443',
});

export const TOOL_DEFINITIONS: ToolDefinition[] = [
	{
		value: 'asn_lookup',
		name: 'ASN Lookup',
		description: 'Look up an autonomous system',
		args: [query],
	},
	{ value: 'check_dns', name: 'Check DNS', description: 'Resolve a domain', args: [domain] },
	{
		value: 'check_ssl',
		name: 'Check SSL',
		description: 'Inspect a TLS certificate',
		args: [host(), port(false)],
	},
	{
		value: 'dkim_check',
		name: 'DKIM Check',
		description: 'Check a DKIM record',
		args: [
			domain,
			{
				name: 'selector',
				displayName: 'Selector',
				type: 'string',
				required: true,
				placeholder: 'e.g. default',
			},
		],
	},
	{
		value: 'dmarc_check',
		name: 'DMARC Check',
		description: 'Check a DMARC record',
		args: [domain],
	},
	{
		value: 'dns_propagation',
		name: 'DNS Propagation',
		description: 'Check DNS propagation',
		args: [domain],
	},
	{
		value: 'dnsbl_check',
		name: 'DNSBL Check',
		description: 'Check an IP against blocklists',
		args: [ip],
	},
	{
		value: 'domain_expiry',
		name: 'Domain Expiry',
		description: 'Check when a domain expires',
		args: [domain],
	},
	{ value: 'hsts_check', name: 'HSTS Check', description: 'Check the HSTS policy', args: [domain] },
	{
		value: 'http_headers',
		name: 'HTTP Headers',
		description: 'Read the response headers',
		args: [url],
	},
	{
		value: 'ip_geolocation',
		name: 'IP Geolocation',
		description: 'Locate an IP address',
		args: [query],
	},
	{ value: 'mx_lookup', name: 'MX Lookup', description: 'Look up mail exchangers', args: [domain] },
	{
		value: 'ping_test',
		name: 'Ping Test',
		description: 'Ping a host',
		args: [host(), port(false)],
	},
	{
		value: 'port_check',
		name: 'Port Check',
		description: 'Check whether a port answers',
		args: [host(), port(true)],
	},
	{
		value: 'redirect_check',
		name: 'Redirect Check',
		description: 'Follow a redirect chain',
		args: [url],
	},
	{
		value: 'response_time',
		name: 'Response Time',
		description: 'Measure the response time',
		args: [url],
	},
	{
		value: 'reverse_dns',
		name: 'Reverse DNS',
		description: 'Resolve an IP to a hostname',
		args: [ip],
	},
	{ value: 'spf_check', name: 'SPF Check', description: 'Check an SPF record', args: [domain] },
	{
		value: 'website_status',
		name: 'Website Status',
		description: 'Check whether a site is up',
		args: [url],
	},
	{ value: 'whois', name: 'WHOIS', description: 'Look up WHOIS data', args: [domain] },
];

/* eslint-enable n8n-nodes-base/node-param-default-missing */

/**
 * The endpoint speaks streamable HTTP, so a successful call answers either with a JSON object or
 * with an event stream whose last `data:` frame carries the JSON-RPC response.
 */
export function parseMcpBody(raw: unknown): IDataObject {
	if (typeof raw === 'object' && raw !== null) return raw as IDataObject;

	if (typeof raw === 'string') {
		const trimmed = raw.trim();

		if (trimmed.startsWith('{')) {
			return JSON.parse(trimmed) as IDataObject;
		}

		const frames = trimmed
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice('data:'.length).trim());

		const last = frames[frames.length - 1];
		if (last !== undefined) return JSON.parse(last) as IDataObject;
	}

	throw new Error('Unreadable MCP response');
}

export function readToolResult(rpc: IDataObject): {
	structured: IDataObject;
	isError: boolean;
	text: string;
} {
	const rpcError = rpc.error as { message?: string } | undefined;

	if (rpcError !== undefined) {
		return { structured: {}, isError: true, text: rpcError.message ?? 'MCP request failed' };
	}

	const result = (rpc.result ?? {}) as {
		isError?: boolean;
		content?: Array<{ type?: string; text?: string }>;
		structuredContent?: IDataObject;
	};

	const text = result.content?.find((block) => block.type === 'text')?.text ?? '';

	return {
		structured: result.structuredContent ?? {},
		isError: result.isError === true,
		text,
	};
}
