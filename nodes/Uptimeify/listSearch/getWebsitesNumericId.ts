import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { extractItems, uptimeifyApiRequest } from '../shared/transport';

type WebsiteRow = { id: number; publicId: string; name: string; url: string };

/**
 * Same endpoint and rows as `getWebsites`, but returns the numeric `id` instead of the public
 * `publicId` UUID. See `getCustomersNumericId` for why this exists alongside `getWebsites` rather
 * than replacing it - do not consolidate them.
 */
export async function getWebsitesNumericId(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const page = paginationToken === undefined ? 1 : Number(paginationToken);
	const perPage = 100;

	const response = await uptimeifyApiRequest.call(this, 'GET', '/api/websites', undefined, {
		search: filter,
		page,
		perPage,
	});

	const rows = extractItems(response) as unknown as WebsiteRow[];
	const total = (response as { total?: number }).total ?? rows.length;

	return {
		results: rows.map((row) => ({ name: `${row.name} (${row.url})`, value: row.id })),
		paginationToken: page * perPage < total ? String(page + 1) : undefined,
	};
}
