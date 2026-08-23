import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

/**
 * `payload` is user-typed JSON, so a typo shouldn't surface as a raw `SyntaxError` with no
 * indication of which field or whose input caused it. Duplicated from
 * notificationChannel/execute.ts's `parseJsonParameter`, which is module-private there and out
 * of this task's file scope to export.
 */
function parseJsonParameter(
	context: IExecuteFunctions,
	raw: unknown,
	itemIndex: number,
): IDataObject {
	if (typeof raw !== 'string') return (raw ?? {}) as IDataObject;

	try {
		return JSON.parse(raw) as IDataObject;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new NodeOperationError(context.getNode(), `Payload is not valid JSON: ${reason}`, {
			itemIndex,
		});
	}
}

export const executeImIncident: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'ingestEvent') {
		const payload = parseJsonParameter(
			this,
			this.getNodeParameter('payload', itemIndex),
			itemIndex,
		);

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/im/events', payload)) as IDataObject;
	}

	if (operation === 'create') {
		const additional = this.getNodeParameter('additionalFields', itemIndex) as IDataObject;

		if (typeof additional.customerId === 'object' && additional.customerId !== null) {
			additional.customerId = (additional.customerId as { value?: string }).value;
		}

		const body: IDataObject = {
			...additional,
			// Set after the spread so the required top-level fields always win, even though
			// Additional Fields has no colliding keys today - see customerDomain/execute.ts.
			teamId: Number(
				this.getNodeParameter('teamId', itemIndex, undefined, { extractValue: true }) as
					| string
					| number,
			),
			title: this.getNodeParameter('title', itemIndex) as string,
			severity: this.getNodeParameter('severity', itemIndex) as string,
		};

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/im/incidents', body)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const filters = this.getNodeParameter('filters', itemIndex) as IDataObject;

		return await uptimeifyApiRequestAllItems.call(this, '/api/im/incidents', filters, {
			mode: 'cursor',
			limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
		});
	}

	const incidentId = this.getNodeParameter('incidentId', itemIndex) as number;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/im/incidents/${incidentId}`,
		)) as IDataObject;
	}

	if (operation === 'updateStatus') {
		const body: IDataObject = { status: this.getNodeParameter('status', itemIndex) as string };

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/im/incidents/${incidentId}/status`,
			body,
		)) as IDataObject;
	}

	if (operation === 'resolve') {
		const note = this.getNodeParameter('note', itemIndex) as string;
		const body: IDataObject = note === '' ? {} : { note };

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/im/incidents/${incidentId}/resolve`,
			body,
		)) as IDataObject;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for Incident Management incidents`,
		{ itemIndex },
	);
};
