import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { extractItems, uptimeifyApiRequest } from '../shared/transport';

type CustomerRow = { id: number; publicId: string; name: string };

/**
 * Same endpoint and rows as `getCustomers`, but returns the numeric `id` instead of the public
 * `publicId` UUID. Most Uptimeify endpoints accept either, but `POST /api/notification-channels`
 * - used by the Uptimeify Trigger to scope its webhook channel - only accepts the numeric id, so
 * this exists alongside `getCustomers` rather than replacing it. Do not consolidate them: the
 * Uptimeify action node's Customer picker depends on `getCustomers` returning the UUID.
 */
export async function getCustomersNumericId(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await uptimeifyApiRequest.call(this, 'GET', '/api/customers', undefined, {
		fields: 'minimal',
	});

	const rows = extractItems(response) as unknown as CustomerRow[];
	const needle = filter?.toLowerCase();

	return {
		results: rows
			.filter((row) => needle === undefined || row.name.toLowerCase().includes(needle))
			.map((row) => ({ name: row.name, value: row.id })),
	};
}
