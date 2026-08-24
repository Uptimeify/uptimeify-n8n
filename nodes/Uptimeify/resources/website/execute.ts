import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { assertNonEmptyUpdateBody } from '../../shared/parse';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeWebsite: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const body: IDataObject = {
			...(this.getNodeParameter('additionalFields', itemIndex) as IDataObject),
			// Set after the spread so the required top-level fields always win, even if the
			// user also filled in a colliding Additional Fields option.
			customerId: this.getNodeParameter('customerId', itemIndex, undefined, {
				extractValue: true,
			}) as string,
			name: this.getNodeParameter('name', itemIndex) as string,
			url: this.getNodeParameter('url', itemIndex) as string,
		};

		if (typeof body.allowedCheckCountryCodes === 'string') {
			const codes = body.allowedCheckCountryCodes
				.split(',')
				.map((code) => code.trim())
				.filter((code) => code !== '');
			body.allowedCheckCountryCodes = codes.length === 0 ? null : codes;
		}

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/websites', body)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const filters = this.getNodeParameter('filters', itemIndex) as IDataObject;
		const qs: IDataObject = { ...filters };

		if (typeof qs.customerId === 'object' && qs.customerId !== null) {
			qs.customerId = (qs.customerId as { value?: string }).value;
		}

		return await uptimeifyApiRequestAllItems.call(this, '/api/websites', qs, {
			mode: 'page',
			limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
		});
	}

	const websiteId = this.getNodeParameter('websiteId', itemIndex, undefined, {
		extractValue: true,
	}) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/websites/${websiteId}`,
		)) as IDataObject;
	}

	if (operation === 'update') {
		const body = this.getNodeParameter('updateFields', itemIndex) as IDataObject;
		assertNonEmptyUpdateBody(this, body, 'Update Fields', itemIndex);

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/websites/${websiteId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'changeStatus') {
		const body: IDataObject = { status: this.getNodeParameter('status', itemIndex) as string };

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/websites/${websiteId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/websites/${websiteId}`);
		return { success: true, websiteId };
	}

	if (operation === 'triggerCheck') {
		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/websites/${websiteId}/trigger-check`,
			{},
		)) as IDataObject;
	}

	if (operation === 'getCheckHistory') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const checkType = this.getNodeParameter('checkType', itemIndex) as string;
		const limit = returnAll ? 200 : (this.getNodeParameter('limit', itemIndex) as number);

		const response = await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/websites/${websiteId}/check-history`,
			undefined,
			{ limit: Math.min(limit, 200), checkType },
		);

		const rows = (response as { data?: IDataObject[] }).data ?? [];
		return returnAll ? rows : rows.slice(0, limit);
	}

	if (operation === 'getUptimeStats') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/websites/${websiteId}/uptime-stats`,
		)) as IDataObject;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for websites`,
		{ itemIndex },
	);
};
