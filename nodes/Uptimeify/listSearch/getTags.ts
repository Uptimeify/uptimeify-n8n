import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { extractItems, uptimeifyApiRequest } from '../shared/transport';

type TagRow = { id: number; name: string; color: string };

export async function getTags(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await uptimeifyApiRequest.call(this, 'GET', '/api/tags');
	const rows = extractItems(response) as unknown as TagRow[];
	const needle = filter?.toLowerCase();

	return {
		results: rows
			.filter((row) => needle === undefined || row.name.toLowerCase().includes(needle))
			.map((row) => ({ name: row.name, value: row.id })),
	};
}
