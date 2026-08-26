import type { INodeProperties } from 'n8n-workflow';
import { TOOL_DEFINITIONS } from '../../shared/mcp';

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
				displayOptions: { show: { resource: ['networkDiagnostics'], operation: [tool.value] } },
			});
		}
	}

	return properties;
}

export const networkDiagnosticsDescription: INodeProperties[] = [
	{
		displayName:
			"This node still needs an Uptimeify credential configured, the same as every other resource. However, Network Diagnostics requests are sent unauthenticated to the public uptimeify.io endpoint and ignore the credential's Base URL.",
		name: 'networkDiagnosticsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['networkDiagnostics'] } },
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['networkDiagnostics'] } },
		options: TOOL_DEFINITIONS.map((tool) => ({
			name: tool.name,
			value: tool.value,
			description: tool.description,
			action: tool.action ?? tool.description,
		})),
		default: 'website_status',
	},
	...buildArgumentProperties(),
];
