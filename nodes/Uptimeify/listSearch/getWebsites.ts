import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { extractItems, uptimeifyApiRequest } from '../shared/transport';

type WebsiteRow = { publicId: string; name: string; url: string };

export async function getWebsites(
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
		results: rows.map((row) => ({ name: `${row.name} (${row.url})`, value: row.publicId })),
		paginationToken: page * perPage < total ? String(page + 1) : undefined,
	};
}
