import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

function parseJsonParameter(raw: unknown): IDataObject {
	if (typeof raw !== 'string') return (raw ?? {}) as IDataObject;
	return JSON.parse(raw) as IDataObject;
}

export const executeNotificationChannel: ResourceExecute = async function (
	this,
	operation,
	itemIndex,
) {
	if (operation === 'create') {
		const additional = this.getNodeParameter('additionalFields', itemIndex) as IDataObject;

		if (typeof additional.customerId === 'object' && additional.customerId !== null) {
			additional.customerId = (additional.customerId as { value?: string }).value;
		}

		const body: IDataObject = {
			...additional,
			// Set after the spread so the required top-level fields always win, even though
			// Additional Fields has no colliding keys today - see customerDomain/execute.ts.
			type: this.getNodeParameter('type', itemIndex) as string,
			name: this.getNodeParameter('name', itemIndex) as string,
			config: parseJsonParameter(this.getNodeParameter('config', itemIndex)),
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			'/api/notification-channels',
			body,
		)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/notification-channels',
			{},
			{
				mode: 'array',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	if (operation === 'test') {
		const body: IDataObject = {
			type: this.getNodeParameter('testType', itemIndex) as string,
			config: parseJsonParameter(this.getNodeParameter('config', itemIndex)),
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			'/api/notification-channels/test',
			body,
		)) as IDataObject;
	}

	const channelId = this.getNodeParameter('channelId', itemIndex) as string;

	if (operation === 'update') {
		const body = this.getNodeParameter('updateFields', itemIndex) as IDataObject;
		if (body.config !== undefined) body.config = parseJsonParameter(body.config);

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/notification-channels/${channelId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/notification-channels/${channelId}`);
		return { success: true, channelId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for notification channels`,
		{ itemIndex },
	);
};
