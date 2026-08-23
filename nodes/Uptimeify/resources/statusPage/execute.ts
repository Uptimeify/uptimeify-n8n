import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeStatusPage: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const body: IDataObject = {
			customerId: this.getNodeParameter('customerId', itemIndex, undefined, {
				extractValue: true,
			}) as string,
			name: this.getNodeParameter('name', itemIndex) as string,
			...(this.getNodeParameter('fields', itemIndex) as IDataObject),
		};

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/status-pages', body)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/status-pages',
			{},
			{
				mode: 'array',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const statusPageId = this.getNodeParameter('statusPageId', itemIndex) as string;

	if (operation === 'update') {
		const body = this.getNodeParameter('fields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/status-pages/${statusPageId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/status-pages/${statusPageId}`);
		return { success: true, statusPageId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for status pages`,
		{ itemIndex },
	);
};
