import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

type TargetEntry = { type: string; id: string };

/** Shared by Create and Preview Occurrences, which take the same body. */
function buildWindowBody(context: IExecuteFunctions, itemIndex: number): IDataObject {
	const body: IDataObject = {
		...(context.getNodeParameter('additionalFields', itemIndex) as IDataObject),
		// Set after the spread so the required top-level fields always win, even though
		// Additional Fields has no colliding keys today - see customerDomain/execute.ts.
		name: context.getNodeParameter('name', itemIndex) as string,
		startTime: context.getNodeParameter('startTime', itemIndex) as string,
		endTime: context.getNodeParameter('endTime', itemIndex) as string,
	};

	const targeting = context.getNodeParameter('targeting', itemIndex) as string;

	if (targeting === 'customer') {
		body.customerId = context.getNodeParameter('customerId', itemIndex, undefined, {
			extractValue: true,
		}) as string;
	}

	if (targeting === 'targets') {
		const entries = ((context.getNodeParameter('targets', itemIndex) as IDataObject).target ??
			[]) as unknown as TargetEntry[];
		body.targets = entries.map((entry) => ({ type: entry.type, id: entry.id }));
	}

	if (targeting === 'tags') {
		body.tagIds = (context.getNodeParameter('tagIds', itemIndex) as string)
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id !== '')
			.map((id) => Number(id));
	}

	return body;
}

export const executeMaintenanceWindow: ResourceExecute = async function (
	this,
	operation,
	itemIndex,
) {
	if (operation === 'create') {
		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			'/api/maintenance-windows',
			buildWindowBody(this, itemIndex),
		)) as IDataObject;
	}

	if (operation === 'previewOccurrences') {
		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			'/api/maintenance-windows/preview-occurrences',
			buildWindowBody(this, itemIndex),
		)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/maintenance-windows',
			{},
			{
				mode: 'page',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const windowId = this.getNodeParameter('maintenanceWindowId', itemIndex) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/maintenance-windows/${windowId}`,
		)) as IDataObject;
	}

	if (operation === 'update') {
		const body = this.getNodeParameter('updateFields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/maintenance-windows/${windowId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/maintenance-windows/${windowId}`);
		return { success: true, maintenanceWindowId: windowId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for maintenance windows`,
		{ itemIndex },
	);
};
