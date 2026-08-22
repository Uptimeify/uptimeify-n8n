import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { getCustomers } from './listSearch/getCustomers';
import { getMonitors } from './listSearch/getMonitors';
import { getTags } from './listSearch/getTags';
import { getTeams } from './listSearch/getTeams';
import { getWebsites } from './listSearch/getWebsites';
import { websiteDescription } from './resources/website';
import { executeWebsite } from './resources/website/execute';
import type { ResourceExecute } from './shared/types';

const RESOURCE_EXECUTORS: Record<string, ResourceExecute> = {
	website: executeWebsite,
};

export class Uptimeify implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Uptimeify',
		name: 'uptimeify',
		icon: { light: 'file:../../icons/uptimeify.svg', dark: 'file:../../icons/uptimeify.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage monitors, incidents and status pages in Uptimeify',
		defaults: { name: 'Uptimeify' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'uptimeifyApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Website', value: 'website' }],
				default: 'website',
			},
			...websiteDescription,
		],
	};

	methods = {
		listSearch: {
			getCustomers,
			getMonitors,
			getTags,
			getTeams,
			getWebsites,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const executor = RESOURCE_EXECUTORS[resource];

				if (executor === undefined) {
					throw new NodeOperationError(this.getNode(), `Unknown resource "${resource}"`, {
						itemIndex: i,
					});
				}

				const result = await executor.call(this, operation, i);
				const rows: IDataObject[] = Array.isArray(result) ? result : [result];

				returnData.push(...rows.map((row) => ({ json: row, pairedItem: { item: i } })));
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				// `NodeOperationError`/`NodeApiError` return the same instance untouched when
				// `error` is already one of their own kind, so re-wrapping by type is lossless
				// for the errors a resource or the transport actually throws.
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
				}

				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
