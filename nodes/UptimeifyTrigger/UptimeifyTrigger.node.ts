import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { extractItems, uptimeifyApiRequest } from '../Uptimeify/shared/transport';
import { createWebhookSecret, isValidSignature } from './shared/signature';

type ChannelRow = { id: number; config?: { url?: string } };

export class UptimeifyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Uptimeify Trigger',
		name: 'uptimeifyTrigger',
		icon: { light: 'file:../../icons/uptimeify.svg', dark: 'file:../../icons/uptimeify.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["scope"]}}',
		description: 'Starts a workflow when Uptimeify raises or resolves an alert',
		defaults: { name: 'Uptimeify Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'uptimeifyApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
				rawBody: true,
			},
		],
		properties: [
			{
				displayName: 'Scope',
				name: 'scope',
				type: 'options',
				options: [
					{ name: 'Organization', value: 'organization' },
					{ name: 'Customer', value: 'customer' },
					{ name: 'Website', value: 'website' },
				],
				default: 'organization',
				description: 'Which monitors this webhook channel covers',
			},
			{
				displayName: 'Customer ID',
				name: 'customerId',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				required: true,
				description: 'Numeric customer ID the channel is scoped to',
				displayOptions: { show: { scope: ['customer', 'website'] } },
			},
			{
				displayName: 'Website ID',
				name: 'websiteId',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				required: true,
				description: 'Numeric website ID for a website-level override',
				displayOptions: { show: { scope: ['website'] } },
			},
			{
				displayName: 'Source Channel ID',
				name: 'sourceChannelId',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				required: true,
				description: 'Parent channel a website-level override belongs to',
				displayOptions: { show: { scope: ['website'] } },
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{ name: 'Alert', value: 'alert' },
					{ name: 'Recovery', value: 'recovery' },
					{ name: 'Reminder', value: 'reminder' },
					{ name: 'Slow', value: 'slow' },
					{ name: 'Unstable', value: 'unstable' },
					{ name: 'Warning', value: 'warning' },
				],
				default: [],
				description: 'Which notification types start the workflow. Empty means all of them.',
			},
			{
				displayName: 'Verify Signature',
				name: 'verifySignature',
				type: 'boolean',
				default: true,
				description:
					'Whether to check the HMAC-SHA256 signature Uptimeify sends. Turn this off only behind a proxy that rewrites the request body.',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');

				// `getNodeWebhookUrl` is typed as possibly undefined. Without this guard, an
				// undefined URL would compare equal to any channel whose config genuinely has no
				// `url` (email, SMS, Slack, ...), matching the first one and letting `create()` -
				// the only place a secret is generated - never run for it.
				if (webhookUrl === undefined) return false;

				const response = await uptimeifyApiRequest.call(this, 'GET', '/api/notification-channels');

				const match = (extractItems(response) as unknown as ChannelRow[]).find(
					(channel) => channel.config?.url === webhookUrl,
				);

				if (match === undefined) return false;

				// A remote channel with this URL exists, but the API never returns the signing
				// secret, so it can only come from this workflow's own static data. A duplicated or
				// re-imported workflow keeps the webhook URL (it's derived from the workflow/webhook
				// ID) but not the static data, which would otherwise report "exists" here, skip
				// `create()`, and leave the trigger rejecting every delivery for lack of a secret.
				// Treating a missing secret as "does not exist" makes `create()` run and replace the
				// orphaned channel with a new one that has a fresh secret.
				if (typeof webhookData.secret !== 'string') return false;

				webhookData.channelId = match.id;
				return true;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');

				if (webhookUrl === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						"Could not determine this webhook's URL. Save the workflow (so it gets a webhook ID) and activate it again.",
					);
				}

				const scope = this.getNodeParameter('scope') as string;
				const secret = createWebhookSecret();

				const body: IDataObject = {
					type: 'webhook',
					name: `n8n — ${this.getWorkflow().name ?? 'workflow'}`,
					category: 'direct',
					config: { url: webhookUrl, method: 'POST', secret, timeout: 30 },
				};

				if (scope === 'customer' || scope === 'website') {
					body.customerId = this.getNodeParameter('customerId') as number;
				}

				if (scope === 'website') {
					body.websiteId = this.getNodeParameter('websiteId') as number;
					body.sourceChannelId = this.getNodeParameter('sourceChannelId') as number;
				}

				const created = (await uptimeifyApiRequest.call(
					this,
					'POST',
					'/api/notification-channels',
					body,
				)) as { id?: number };

				if (created.id === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						'Uptimeify did not return a channel ID for the new webhook channel',
					);
				}

				webhookData.channelId = created.id;
				webhookData.secret = secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const channelId = webhookData.channelId;

				if (channelId === undefined) return true;

				try {
					await uptimeifyApiRequest.call(
						this,
						'DELETE',
						`/api/notification-channels/${String(channelId)}`,
					);
				} catch (error) {
					// A channel that is already gone - deleted from the Uptimeify UI, or left behind by a
					// previous deactivation that failed after the remote delete but before this ran -
					// counts as success. Anything else (403, network error, ...) probably means the
					// channel still exists, so it must keep surfacing instead of silently forgetting the
					// ID and leaking the channel.
					if (!(error instanceof NodeApiError) || error.httpCode !== '404') {
						// `error` is already a NodeApiError here in every real case (uptimeifyApiRequest
						// wraps everything it throws), and the constructor hands back that same instance
						// unchanged - this is not a second, redundant wrap.
						throw new NodeApiError(this.getNode(), error as never);
					}
				}

				delete webhookData.channelId;
				delete webhookData.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const headers = this.getHeaderData();
		const body = this.getBodyData();
		const verifySignature = this.getNodeParameter('verifySignature') as boolean;
		const events = this.getNodeParameter('events') as string[];

		if (verifySignature) {
			const webhookData = this.getWorkflowStaticData('node');
			const secret = webhookData.secret;
			const rawBody = this.getRequestObject().rawBody;

			if (typeof secret !== 'string') {
				throw new NodeOperationError(
					this.getNode(),
					'No signing secret is stored for this trigger. Deactivate and reactivate the workflow so the channel is recreated, or turn Verify Signature off.',
				);
			}

			if (rawBody === undefined) {
				throw new NodeOperationError(
					this.getNode(),
					'The raw request body is not available, so the signature cannot be checked. Turn Verify Signature off if a proxy in front of n8n rewrites the body.',
				);
			}

			if (!isValidSignature(rawBody, headers['x-webhook-signature'], secret)) {
				// Answer the request ourselves so nothing downstream sees an unverified payload.
				this.getResponseObject().status(401).send('Invalid signature');
				return { noWebhookResponse: true };
			}
		}

		const type = (body as { type?: string }).type;

		if (events.length > 0 && (type === undefined || !events.includes(type))) {
			// No `workflowData` means the request is acknowledged without starting a run.
			return {};
		}

		return {
			workflowData: [
				[
					{
						json: {
							...(body as IDataObject),
							_headers: {
								event: headers['x-webhook-event'],
								attempt: headers['x-webhook-attempt'],
								timestamp: headers['x-webhook-timestamp'],
							},
						},
					},
				],
			],
		};
	}
}
