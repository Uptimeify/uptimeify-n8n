import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { assertNonEmptyUpdateBody } from '../../shared/parse';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeStatusPage: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const customer = String(
			this.getNodeParameter('customerId', itemIndex, '', { extractValue: true }) ?? '',
		).trim();

		const body: IDataObject = {
			...(this.getNodeParameter('additionalFields', itemIndex) as IDataObject),
			// Set after the spread so the required top-level fields always win, even if the
			// user also filled in a colliding Additional Fields option.
			name: this.getNodeParameter('name', itemIndex) as string,
		};
		// A stale customerId from Additional Fields must not survive an empty Customer.
		delete body.customerId;

		// Unlike most endpoints this one takes only the numeric customer ID, and the Customer
		// picker hands back the public UUID, so that is looked up first. No customer at all
		// creates a page of the whole organization.
		if (/^\d+$/.test(customer)) {
			body.customerId = Number(customer);
		} else if (customer !== '') {
			const found = (await uptimeifyApiRequest.call(
				this,
				'GET',
				`/api/customers/${customer}`,
			)) as IDataObject;
			body.customerId = found.id;
		}

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/status-pages', body)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/status-pages',
			// Without it the endpoint answers `{ statusPages }`, which `extractItems` does not read.
			{ envelope: 'items' },
			{
				mode: 'array',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const statusPageId = this.getNodeParameter('statusPageId', itemIndex) as string;

	if (operation === 'update') {
		const body = this.getNodeParameter('updateFields', itemIndex) as IDataObject;
		assertNonEmptyUpdateBody(this, body, 'Update Fields', itemIndex);

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
