import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { assertNonEmptyUpdateBody } from '../../shared/parse';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeCustomerIp: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const customerId = this.getNodeParameter('customerId', itemIndex, undefined, {
			extractValue: true,
		}) as string;

		const body: IDataObject = {
			ipAddress: this.getNodeParameter('ipAddress', itemIndex) as string,
			...(this.getNodeParameter('fields', itemIndex) as IDataObject),
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/customers/${customerId}/ips`,
			body,
		)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/customer-ips',
			{},
			{
				mode: 'page',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const ipId = this.getNodeParameter('ipId', itemIndex) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/customer-ips/${ipId}`,
		)) as IDataObject;
	}

	if (operation === 'update') {
		const body = this.getNodeParameter('fields', itemIndex) as IDataObject;
		assertNonEmptyUpdateBody(this, body, 'Fields', itemIndex);

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/customer-ips/${ipId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/customer-ips/${ipId}`);
		return { success: true, ipId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for customer IPs`,
		{ itemIndex },
	);
};
