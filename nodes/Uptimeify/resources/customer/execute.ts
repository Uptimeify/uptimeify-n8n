import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeCustomer: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const body: IDataObject = {
			name: this.getNodeParameter('name', itemIndex) as string,
			email: this.getNodeParameter('email', itemIndex) as string,
			packageType: this.getNodeParameter('packageType', itemIndex) as string,
			...(this.getNodeParameter('additionalFields', itemIndex) as IDataObject),
		};

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/customers', body)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const minimal = this.getNodeParameter('minimal', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/customers',
			minimal ? { fields: 'minimal' } : {},
			{
				mode: 'array',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	if (operation === 'getSmsUsage') {
		return (await uptimeifyApiRequest.call(this, 'GET', '/api/customers/sms-usage')) as IDataObject;
	}

	if (operation === 'bulk') {
		const ids = (this.getNodeParameter('bulkCustomerIds', itemIndex) as string)
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id !== '')
			.map((id) => Number(id));

		const body: IDataObject = {
			action: this.getNodeParameter('bulkAction', itemIndex) as string,
			customerIds: ids,
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			'/api/customers/bulk',
			body,
		)) as IDataObject;
	}

	const customerId = this.getNodeParameter('customerId', itemIndex, undefined, {
		extractValue: true,
	}) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/customers/${customerId}`,
		)) as IDataObject;
	}

	if (operation === 'update') {
		const body = this.getNodeParameter('updateFields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/customers/${customerId}`,
			body,
		)) as IDataObject;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for customers`,
		{ itemIndex },
	);
};
