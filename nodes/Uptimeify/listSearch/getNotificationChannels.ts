import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { extractItems, uptimeifyApiRequest } from '../shared/transport';

type ChannelRow = { id: number; name?: string; type?: string };

/**
 * Notification channels have no separate public UUID - the numeric `id` from
 * `/api/notification-channels` is the only identifier there is, and it is exactly what
 * `POST /api/notification-channels` expects for `sourceChannelId`. Used by the Uptimeify Trigger
 * to pick the parent channel a website-level override belongs to.
 */
export async function getNotificationChannels(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await uptimeifyApiRequest.call(this, 'GET', '/api/notification-channels');
	const rows = extractItems(response) as unknown as ChannelRow[];
	const needle = filter?.toLowerCase();

	return {
		results: rows
			.filter((row) => needle === undefined || (row.name ?? '').toLowerCase().includes(needle))
			.map((row) => ({
				name:
					row.name === undefined ? `Channel ${row.id}` : `${row.name} (${row.type ?? 'webhook'})`,
				value: row.id,
			})),
	};
}
