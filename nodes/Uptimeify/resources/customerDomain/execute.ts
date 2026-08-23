import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeCustomerDomain: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const customerId = this.getNodeParameter('customerId', itemIndex, undefined, {
			extractValue: true,
		}) as string;

		const body: IDataObject = {
			domainName: this.getNodeParameter('domainName', itemIndex) as string,
			...(this.getNodeParameter('fields', itemIndex) as IDataObject),
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/customers/${customerId}/domains`,
			body,
		)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/customer-domains',
			{},
			{
				mode: 'page',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const domainId = this.getNodeParameter('domainId', itemIndex) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/customer-domains/${domainId}`,
		)) as IDataObject;
	}

	if (operation === 'update') {
		const body = this.getNodeParameter('fields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/customer-domains/${domainId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/customer-domains/${domainId}`);
		return { success: true, domainId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for customer domains`,
		{ itemIndex },
	);
};
