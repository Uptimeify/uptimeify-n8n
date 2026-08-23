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
import { customerDescription } from './resources/customer';
import { executeCustomer } from './resources/customer/execute';
import { customerDomainDescription } from './resources/customerDomain';
import { executeCustomerDomain } from './resources/customerDomain/execute';
import { customerIpDescription } from './resources/customerIp';
import { executeCustomerIp } from './resources/customerIp/execute';
import { incidentDescription } from './resources/incident';
import { executeIncident } from './resources/incident/execute';
import { maintenanceWindowDescription } from './resources/maintenanceWindow';
import { executeMaintenanceWindow } from './resources/maintenanceWindow/execute';
import { monitorDescription } from './resources/monitor';
import { executeMonitor } from './resources/monitor/execute';
import { notificationChannelDescription } from './resources/notificationChannel';
import { executeNotificationChannel } from './resources/notificationChannel/execute';
import { statusPageDescription } from './resources/statusPage';
import { executeStatusPage } from './resources/statusPage/execute';
import { tagDescription } from './resources/tag';
import { executeTag } from './resources/tag/execute';
import { websiteDescription } from './resources/website';
import { executeWebsite } from './resources/website/execute';
import type { ResourceExecute } from './shared/types';

const RESOURCE_EXECUTORS: Record<string, ResourceExecute> = {
	customer: executeCustomer,
	customerDomain: executeCustomerDomain,
	customerIp: executeCustomerIp,
	incident: executeIncident,
	maintenanceWindow: executeMaintenanceWindow,
	monitor: executeMonitor,
	notificationChannel: executeNotificationChannel,
	statusPage: executeStatusPage,
	tag: executeTag,
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
				options: [
					{ name: 'Customer', value: 'customer' },
					{ name: 'Customer Domain', value: 'customerDomain' },
					{ name: 'Customer IP', value: 'customerIp' },
					{ name: 'Incident', value: 'incident' },
					{ name: 'Maintenance Window', value: 'maintenanceWindow' },
					{ name: 'Monitor', value: 'monitor' },
					{ name: 'Notification Channel', value: 'notificationChannel' },
					{ name: 'Status Page', value: 'statusPage' },
					{ name: 'Tag', value: 'tag' },
					{ name: 'Website', value: 'website' },
				],
				default: 'website',
			},
			...customerDescription,
			...customerDomainDescription,
			...customerIpDescription,
			...incidentDescription,
			...maintenanceWindowDescription,
			...monitorDescription,
			...notificationChannelDescription,
			...statusPageDescription,
			...tagDescription,
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
