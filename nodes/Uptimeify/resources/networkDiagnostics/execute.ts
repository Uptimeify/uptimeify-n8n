import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { MCP_ENDPOINT, parseMcpBody, readToolResult, TOOL_DEFINITIONS } from '../../shared/mcp';
import type { ResourceExecute } from '../../shared/types';

// Deliberately unauthenticated: the MCP endpoint is a public, credential-free service, and
// `MCP_ENDPOINT` is a fixed host (see the comment on it in `shared/mcp.ts`) - not derived from the
// node's credential, so this uses the plain `httpRequest` helper rather than the authenticated
// transport helper the other resources use, and ignores the credential's Base URL entirely.
export const executeNetworkDiagnostics: ResourceExecute = async function (
	this,
	operation,
	itemIndex,
) {
	const tool = TOOL_DEFINITIONS.find((entry) => entry.value === operation);

	if (tool === undefined) {
		throw new NodeOperationError(this.getNode(), `Unknown tool "${operation}"`, {
			itemIndex,
		});
	}

	const args: IDataObject = {};

	for (const argument of tool.args) {
		const value = this.getNodeParameter(`${tool.value}_${argument.key}`, itemIndex) as
			| string
			| number;

		if (value === '' || value === 0) {
			if (argument.required) {
				throw new NodeOperationError(
					this.getNode(),
					`"${argument.label}" is required for ${tool.name}`,
					{ itemIndex },
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
			id: itemIndex + 1,
			method: 'tools/call',
			params: { name: tool.value, arguments: args },
		},
		json: true,
		returnFullResponse: true,
	});

	const parsed = parseMcpBody((response as { body: unknown }).body);
	const result = readToolResult(parsed);

	if (result.isError) {
		throw new NodeOperationError(this.getNode(), result.text, { itemIndex });
	}

	return Object.keys(result.structured).length > 0 ? result.structured : { text: result.text };
};
