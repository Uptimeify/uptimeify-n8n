import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeIncident: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const filters = this.getNodeParameter('filters', itemIndex) as IDataObject;

		return await uptimeifyApiRequestAllItems.call(this, '/api/incidents', filters, {
			mode: 'offset',
			limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
		});
	}

	const incidentId = this.getNodeParameter('incidentId', itemIndex) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/incidents/${incidentId}`,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/incidents/${incidentId}`);
		return { success: true, incidentId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for incidents`,
		{ itemIndex },
	);
};
