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
import { imIncidentDescription } from './resources/imIncident';
import { executeImIncident } from './resources/imIncident/execute';
import { imOnCallDescription } from './resources/imOnCall';
import { executeImOnCall } from './resources/imOnCall/execute';
import { imScheduleDescription } from './resources/imSchedule';
import { executeImSchedule } from './resources/imSchedule/execute';
import { imTeamDescription } from './resources/imTeam';
import { executeImTeam } from './resources/imTeam/execute';
import { incidentDescription } from './resources/incident';
import { executeIncident } from './resources/incident/execute';
import { maintenanceWindowDescription } from './resources/maintenanceWindow';
import { executeMaintenanceWindow } from './resources/maintenanceWindow/execute';
import { monitorDescription } from './resources/monitor';
import { executeMonitor } from './resources/monitor/execute';
import { networkDiagnosticsDescription } from './resources/networkDiagnostics';
import { executeNetworkDiagnostics } from './resources/networkDiagnostics/execute';
import { notificationChannelDescription } from './resources/notificationChannel';
import { executeNotificationChannel } from './resources/notificationChannel/execute';
import { statusPageDescription } from './resources/statusPage';
import { executeStatusPage } from './resources/statusPage/execute';
import { tagDescription } from './resources/tag';
import { executeTag } from './resources/tag/execute';
import { websiteDescription } from './resources/website';
import { executeWebsite } from './resources/website/execute';
import type { ResourceExecute } from './shared/types';

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

const RESOURCE_EXECUTORS: Record<string, ResourceExecute> = {
	customer: executeCustomer,
	customerDomain: executeCustomerDomain,
	customerIp: executeCustomerIp,
	imIncident: executeImIncident,
	imOnCall: executeImOnCall,
	imSchedule: executeImSchedule,
	imTeam: executeImTeam,
	incident: executeIncident,
	maintenanceWindow: executeMaintenanceWindow,
	monitor: executeMonitor,
	networkDiagnostics: executeNetworkDiagnostics,
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
		// `$parameter["operation"]`/`$parameter["resource"]` resolve to their `value`s (e.g.
		// `getAll`/`imSchedule`), not their `name`s, so the default subtitle behaviour would show
		// those raw values on the canvas. These inline lookups show the human-readable names
		// instead, without changing the operation/resource values themselves. The operation lookup
		// also covers the Network Diagnostics tool names (`asn_lookup`, `check_ssl`, ...) - this
		// replaces the equivalent lookup that used to live in the now-removed
		// `UptimeifyTools.node.ts`. Has to be a plain string literal (not built at runtime) for
		// n8n-nodes-base/node-class-description-missing-subtitle to recognize it.
		subtitle:
			'={{({"asn_lookup":"ASN Lookup","assign":"Assign to Monitor","bulk":"Bulk Action","changeStatus":"Change Status","check_dns":"Check DNS","check_ssl":"Check SSL","create":"Create","createOverride":"Create Override","delete":"Delete","dkim_check":"DKIM Check","dmarc_check":"DMARC Check","dns_propagation":"DNS Propagation","dnsbl_check":"DNSBL Check","domain_expiry":"Domain Expiry","get":"Get","getAlertHistory":"Get Alert History","getAll":"Get Many","getCheckHistory":"Get Check History","getIncidentHistory":"Get Incident History","getSmsUsage":"Get SMS Usage","getUptimeStats":"Get Uptime Stats","hsts_check":"HSTS Check","http_headers":"HTTP Headers","ingestEvent":"Ingest Event","ip_geolocation":"IP Geolocation","mx_lookup":"MX Lookup","ping_test":"Ping Test","port_check":"Port Check","redirect_check":"Redirect Check","remove":"Remove From Monitor","resolve":"Resolve","response_time":"Response Time","reverse_dns":"Reverse DNS","spf_check":"SPF Check","test":"Test","triggerCheck":"Trigger Check","update":"Update","updateStatus":"Update Status","website_status":"Website Status","whois":"WHOIS"})[$parameter["operation"]] + ": " + ({"customer":"Customer","customerDomain":"Customer Domain","customerIp":"Customer IP","imIncident":"Incident Management: Incident","imOnCall":"Incident Management: On-Call","imSchedule":"Incident Management: Schedule","imTeam":"Incident Management: Team","incident":"Incident","maintenanceWindow":"Maintenance Window","monitor":"Monitor","networkDiagnostics":"Network Diagnostic","notificationChannel":"Notification Channel","statusPage":"Status Page","tag":"Tag","website":"Website"})[$parameter["resource"]]}}',
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
					{ name: 'Incident Management: Incident', value: 'imIncident' },
					{ name: 'Incident Management: On-Call', value: 'imOnCall' },
					{ name: 'Incident Management: Schedule', value: 'imSchedule' },
					{ name: 'Incident Management: Team', value: 'imTeam' },
					{ name: 'Maintenance Window', value: 'maintenanceWindow' },
					{ name: 'Monitor', value: 'monitor' },
					{ name: 'Network Diagnostic', value: 'networkDiagnostics' },
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
			...imIncidentDescription,
			...imOnCallDescription,
			...imScheduleDescription,
			...imTeamDescription,
			...maintenanceWindowDescription,
			...monitorDescription,
			...networkDiagnosticsDescription,
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
			let resource: string | undefined;

			try {
				resource = this.getNodeParameter('resource', i) as string;
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
				if (resource === 'networkDiagnostics') {
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
