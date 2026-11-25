import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { assertNonEmptyUpdateBody } from '../../shared/parse';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeStatusPage: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const customerId = this.getNodeParameter('customerId', itemIndex, undefined, {
			extractValue: true,
		}) as string;

		const body: IDataObject = {
			...(this.getNodeParameter('additionalFields', itemIndex) as IDataObject),
			// Set after the spread so the required top-level fields always win, even if the
			// user also filled in a colliding Additional Fields option.
			customerId,
			name: this.getNodeParameter('name', itemIndex) as string,
		};

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
