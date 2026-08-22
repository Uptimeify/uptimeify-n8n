import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { MONITOR_PATHS } from '../shared/descriptions';
import { extractItems, uptimeifyApiRequest } from '../shared/transport';

type MonitorRow = { publicId: string; name: string; hostname?: string };

export async function getMonitors(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const monitorType = this.getNodeParameter('monitorType', 'dns') as string;
	const path = MONITOR_PATHS[monitorType] ?? MONITOR_PATHS.dns;
	const page = paginationToken === undefined ? 1 : Number(paginationToken);
	const perPage = 100;

	const response = await uptimeifyApiRequest.call(this, 'GET', path, undefined, {
		search: filter,
		page,
		perPage,
	});

	const rows = extractItems(response) as unknown as MonitorRow[];
	const total = (response as { total?: number }).total ?? rows.length;

	return {
		results: rows.map((row) => ({
			name: row.hostname === undefined ? row.name : `${row.name} (${row.hostname})`,
			value: row.publicId,
		})),
		paginationToken: page * perPage < total ? String(page + 1) : undefined,
	};
}
