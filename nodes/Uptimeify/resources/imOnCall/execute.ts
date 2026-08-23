import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeImOnCall: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'whoIsOnCall') {
		return await uptimeifyApiRequestAllItems.call(this, '/api/im/on-call', {}, { mode: 'array' });
	}

	if (operation === 'getTeams') {
		return await uptimeifyApiRequestAllItems.call(this, '/api/im/teams', {}, { mode: 'array' });
	}

	if (operation === 'getSchedules') {
		return await uptimeifyApiRequestAllItems.call(this, '/api/im/schedules', {}, { mode: 'array' });
	}

	if (operation === 'createOverride') {
		const scheduleId = this.getNodeParameter('scheduleId', itemIndex) as number;
		const body: IDataObject = {
			userId: this.getNodeParameter('userId', itemIndex) as string,
			startsAt: this.getNodeParameter('startsAt', itemIndex) as string,
			endsAt: this.getNodeParameter('endsAt', itemIndex) as string,
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/im/schedules/${scheduleId}/overrides`,
			body,
		)) as IDataObject;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for on-call data`,
		{ itemIndex },
	);
};
