import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { MCP_ENDPOINT, parseMcpBody, readToolResult, TOOL_DEFINITIONS } from './shared/mcp';

function buildArgumentProperties(): INodeProperties[] {
	const properties: INodeProperties[] = [];

	for (const tool of TOOL_DEFINITIONS) {
		for (const argument of tool.args) {
			properties.push({
				displayName: argument.label,
				name: `${tool.value}_${argument.key}`,
				type: argument.kind,
				default: argument.kind === 'number' ? 0 : '',
				required: argument.required,
				placeholder: argument.placeholder,
				displayOptions: { show: { operation: [tool.value] } },
			});
		}
	}

	return properties;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * `this.helpers.httpRequest` rethrows the raw Axios error unmodified on a non-2xx response (see
 * `@n8n/backend-network`'s `invokeAxios`, which only intercepts a 401 digest-auth challenge and
 * otherwise does a bare `throw error`). That error carries the status at `error.response.status`,
 * not `error.statusCode` - n8n-workflow's own `NodeApiError` constructor reads the same property
 * for an `AxiosError`. `error` may not even be an object, so every step here is defensive.
 */
function extractStatusCode(error: unknown): number | undefined {
	if (!isRecord(error)) return undefined;

	const response = error.response;
	if (!isRecord(response)) return undefined;

	return typeof response.status === 'number' ? response.status : undefined;
}

/** On a 429, the endpoint's JSON body - parsed by Axios into `error.response.data` - carries the
 *  wait hint as `retryAfter`. */
function extractRetryAfter(error: unknown): number | undefined {
	if (!isRecord(error)) return undefined;

	const response = error.response;
	if (!isRecord(response)) return undefined;

	const data = response.data;
	if (!isRecord(data)) return undefined;

	return typeof data.retryAfter === 'number' ? data.retryAfter : undefined;
}

export class UptimeifyTools implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Uptimeify Tools',
		name: 'uptimeifyTools',
		icon: { light: 'file:../../icons/uptimeify.svg', dark: 'file:../../icons/uptimeify.dark.svg' },
		group: ['transform'],
		version: 1,
		// `$parameter["operation"]` resolves to the option's `value` (the MCP wire-format tool
		// name, e.g. `dns_propagation`), not its `name`, so the default subtitle behaviour would show
		// that raw value on the canvas. This inline lookup shows the human-readable tool name instead,
		// without changing the operation values themselves. Has to be a plain string literal (not
		// built at runtime) for n8n-nodes-base/node-class-description-missing-subtitle to recognize it;
		// its mapping is covered by a test asserting it stays in sync with TOOL_DEFINITIONS.
		subtitle:
			'={{({"asn_lookup":"ASN Lookup","check_dns":"Check DNS","check_ssl":"Check SSL","dkim_check":"DKIM Check","dmarc_check":"DMARC Check","dns_propagation":"DNS Propagation","dnsbl_check":"DNSBL Check","domain_expiry":"Domain Expiry","hsts_check":"HSTS Check","http_headers":"HTTP Headers","ip_geolocation":"IP Geolocation","mx_lookup":"MX Lookup","ping_test":"Ping Test","port_check":"Port Check","redirect_check":"Redirect Check","response_time":"Response Time","reverse_dns":"Reverse DNS","spf_check":"SPF Check","website_status":"Website Status","whois":"WHOIS"})[$parameter["operation"]]}}',
		description: 'Run Uptimeify public network checks. No account and no credentials needed.',
		defaults: { name: 'Uptimeify Tools' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: TOOL_DEFINITIONS.map((tool) => ({
					name: tool.name,
					value: tool.value,
					description: tool.description,
					action: tool.action ?? tool.description,
				})),
				default: 'website_status',
			},
			...buildArgumentProperties(),
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const tool = TOOL_DEFINITIONS.find((entry) => entry.value === operation);

				if (tool === undefined) {
					throw new NodeOperationError(this.getNode(), `Unknown tool "${operation}"`, {
						itemIndex: i,
					});
				}

				const args: IDataObject = {};

				for (const argument of tool.args) {
					const value = this.getNodeParameter(`${tool.value}_${argument.key}`, i) as
						| string
						| number;

					if (value === '' || value === 0) {
						if (argument.required) {
							throw new NodeOperationError(
								this.getNode(),
								`"${argument.label}" is required for ${tool.name}`,
								{ itemIndex: i },
							);
						}

						continue;
					}

					args[argument.key] = value;
				}

				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: MCP_ENDPOINT,
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json, text/event-stream',
					},
					body: {
						jsonrpc: '2.0',
						id: i + 1,
						method: 'tools/call',
						params: { name: tool.value, arguments: args },
					},
					json: true,
					returnFullResponse: true,
				});

				const parsed = parseMcpBody((response as { body: unknown }).body);
				const result = readToolResult(parsed);

				if (result.isError) {
					throw new NodeOperationError(this.getNode(), result.text, { itemIndex: i });
				}

				returnData.push({
					json:
						Object.keys(result.structured).length > 0 ? result.structured : { text: result.text },
					pairedItem: { item: i },
				});
			} catch (error) {
				const statusCode = extractStatusCode(error);

				if (statusCode === 429) {
					const retryAfter = extractRetryAfter(error);

					const hint =
						retryAfter === undefined
							? 'The rate limit was reached. The limits are 120 requests per minute overall and 15 to 30 per minute per tool, counted per IP.'
							: `The rate limit was reached. Retry in ${retryAfter} seconds.`;

					if (!this.continueOnFail()) {
						throw new NodeApiError(this.getNode(), error as JsonObject, { description: hint });
					}

					returnData.push({ json: { error: hint }, pairedItem: { item: i } });
					continue;
				}

				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				// Rewrap to satisfy the lint rule. Constructors return already-typed errors
				// unchanged, so `itemIndex` only attaches to raw errors.
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
				}

				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
