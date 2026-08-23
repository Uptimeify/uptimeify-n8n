import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeTag: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const body: IDataObject = {
			name: this.getNodeParameter('name', itemIndex) as string,
			color: this.getNodeParameter('color', itemIndex) as string,
		};

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/tags', body)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/tags',
			{},
			{
				mode: 'array',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const tagId = Number(
		this.getNodeParameter('tagId', itemIndex, undefined, {
			extractValue: true,
		}) as string | number,
	);

	if (operation === 'update') {
		const body = this.getNodeParameter('updateFields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/tags/${tagId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/tags/${tagId}`);
		return { success: true, tagId };
	}

	if (operation === 'assign' || operation === 'remove') {
		const body: IDataObject = {
			monitorType: this.getNodeParameter('assignMonitorType', itemIndex) as string,
			monitorId: this.getNodeParameter('assignMonitorId', itemIndex) as number,
			tagId,
		};

		if (operation === 'assign') {
			return (await uptimeifyApiRequest.call(
				this,
				'POST',
				'/api/monitor-tags',
				body,
			)) as IDataObject;
		}

		await uptimeifyApiRequest.call(this, 'DELETE', '/api/monitor-tags', body);
		return { success: true, ...body };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for tags`,
		{
			itemIndex,
		},
	);
};
