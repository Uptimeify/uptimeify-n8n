import type { IDataObject } from 'n8n-workflow';

/** `/mcp` answers only on the canonical host; a custom domain returns 404 before anything else. */
export const MCP_ENDPOINT = 'https://uptimeify.io/mcp';

// Field names deliberately differ from n8n's `name`/`displayName`/`type` triad used by
// `INodeProperties`. n8n-nodes-base's `node-param-default-missing` ESLint rule is a purely
// structural AST match: any object literal with sibling `displayName`, `name` and `type` keys is
// treated as a node parameter definition and required to carry a `default`. These objects are not
// node parameters - they are this file's internal description of an MCP tool's arguments, later
// turned into real `INodeProperties` (which do set a `default`) by `buildArgumentProperties()` in
// `UptimeifyTools.node.ts`. Renaming the fields keeps the rule from pattern-matching on them; do
// not rename them back to `name`/`displayName`/`type`, or n8n's automated verification scan
// (which ignores inline `eslint-disable` comments) rejects the package again.
type ToolArgument = {
	key: string;
	label: string;
	kind: 'string' | 'number';
	required: boolean;
	placeholder: string;
};

export type ToolDefinition = {
	value: string;
	name: string;
	description: string;
	/**
	 * Short verb phrase naming the thing acted on, for n8n's actions panel. Most tool
	 * descriptions already read that way ("Resolve a domain", "Inspect a TLS certificate"), so
	 * this is only set where the description is phrased as a clause instead ("Check whether a
	 * site is up") - see `UptimeifyTools.node.ts`, which falls back to `description` when absent.
	 */
	action?: string;
	args: ToolArgument[];
};

const host = (required = true): ToolArgument => ({
	key: 'host',
	label: 'Host',
	kind: 'string',
	required,
	placeholder: 'e.g. example.com',
});

const domain: ToolArgument = {
	key: 'domain',
	label: 'Domain',
	kind: 'string',
	required: true,
	placeholder: 'e.g. example.com',
};

const url: ToolArgument = {
	key: 'url',
	label: 'URL',
	kind: 'string',
	required: true,
	placeholder: 'e.g. https://example.com',
};

const ip: ToolArgument = {
	key: 'ip',
	label: 'IP Address',
	kind: 'string',
	required: true,
	placeholder: 'e.g. 203.0.113.10',
};

const query: ToolArgument = {
	key: 'query',
	label: 'Query',
	kind: 'string',
	required: true,
	placeholder: 'e.g. 203.0.113.10',
};

const port = (required: boolean): ToolArgument => ({
	key: 'port',
	label: 'Port',
	kind: 'number',
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
				key: 'selector',
				label: 'Selector',
				kind: 'string',
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
		action: 'Check domain expiry',
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
		action: 'Check a port',
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
		action: 'Check website status',
		args: [url],
	},
	{ value: 'whois', name: 'WHOIS', description: 'Look up WHOIS data', args: [domain] },
];

/**
 * Parses a frame (or bare-object string) that is already known to hold JSON. A malformed frame
 * must still surface the domain-level "Unreadable MCP response" message, with the parser's own
 * text appended so a debugging user can see what specifically was wrong.
 */
function parseJsonFrame(text: string): IDataObject {
	let parseErrorMessage: string;

	try {
		return JSON.parse(text) as IDataObject;
	} catch (error) {
		parseErrorMessage = (error as Error).message;
	}

	throw new Error(`Unreadable MCP response: ${parseErrorMessage}`);
}

/**
 * The endpoint speaks streamable HTTP, so a successful call answers either with a JSON object or
 * with an event stream whose last `data:` frame carries the JSON-RPC response.
 */
export function parseMcpBody(raw: unknown): IDataObject {
	if (typeof raw === 'object' && raw !== null) return raw as IDataObject;

	if (typeof raw === 'string') {
		const trimmed = raw.trim();

		if (trimmed.startsWith('{')) {
			return parseJsonFrame(trimmed);
		}

		const frames = trimmed
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice('data:'.length).trim());

		const last = frames[frames.length - 1];
		if (last !== undefined) return parseJsonFrame(last);
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

	const isError = result.isError === true;
	const text = result.content?.find((block) => block.type === 'text')?.text;

	return {
		structured: result.structuredContent ?? {},
		isError,
		// A tool-level error with no text block would otherwise surface as a blank
		// `NodeOperationError` message, so give it the same kind of fallback as an RPC-level error.
		text: text ?? (isError ? 'MCP tool call failed' : ''),
	};
}
