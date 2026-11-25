import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { splitList } from '../../shared/lists';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeImSchedule: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/im/schedules',
			{},
			{
				mode: 'array',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	if (operation === 'createOverride') {
		const scheduleId = this.getNodeParameter('scheduleId', itemIndex) as number;
		const body: IDataObject = {
			userId: this.getNodeParameter('userId', itemIndex) as string,
			startsAt: this.getNodeParameter('startsAt', itemIndex) as string,
			endsAt: this.getNodeParameter('endsAt', itemIndex) as string,
			type: this.getNodeParameter('type', itemIndex) as string,
		};

		const { applyScope, coveredByUserIds } = this.getNodeParameter(
			'additionalFields',
			itemIndex,
		) as IDataObject;
		if (applyScope !== undefined) body.applyScope = applyScope;
		if (typeof coveredByUserIds === 'string') {
			const ids = splitList(coveredByUserIds);
			if (ids.length > 0) body.coveredByUserIds = ids;
		}

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/im/schedules/${scheduleId}/overrides`,
			body,
		)) as IDataObject;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for schedules`,
		{ itemIndex },
	);
};
