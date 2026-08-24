import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { describeUptimeifyError } from './errors';

export type UptimeifyContext =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IHookFunctions
	| IWebhookFunctions;

/** Page size ceiling of the paged endpoints. */
export const MAX_PER_PAGE = 200;

/** Page size ceiling of the cursor-paginated Incident Management endpoints. */
export const MAX_CURSOR_LIMIT = 100;

/** Page size ceiling of the offset-paginated monitoring incidents endpoint. */
export const MAX_OFFSET_LIMIT = 500;

/**
 * Optional query parameters have to be absent, not empty. Uptimeify coerces `organizationId=`
 * to the number 0, which then fails its own minimum constraint with a 400.
 */
export function cleanQuery(qs: IDataObject): IDataObject {
	const cleaned: IDataObject = {};

	for (const [key, value] of Object.entries(qs)) {
		if (value === undefined || value === null || value === '') continue;
		cleaned[key] = value;
	}

	return cleaned;
}

/**
 * List endpoints answer in three shapes: a bare array, `{ items }` for the paged and cursor
 * endpoints, and `{ data }` for the check/alert/incident history endpoints.
 */
export function extractItems(response: unknown): IDataObject[] {
	if (Array.isArray(response)) return response as IDataObject[];

	if (typeof response === 'object' && response !== null) {
		const items = (response as { items?: unknown }).items;
		if (Array.isArray(items)) return items as IDataObject[];

		const data = (response as { data?: unknown }).data;
		if (Array.isArray(data)) return data as IDataObject[];
	}

	return [];
}

export async function uptimeifyApiRequest(
	this: UptimeifyContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs: IDataObject = {},
): Promise<unknown> {
	const credentials = await this.getCredentials('uptimeifyApi');
	const rawBaseUrl = credentials.baseUrl;
	// The field is required with this same default, so `??` alone never fires - except for a
	// user who clears it, which saves an empty string (`'' ?? x` is `''`, not `x`). Trimming
	// first catches that case, and a whitespace-only value the same way.
	const trimmedBaseUrl = typeof rawBaseUrl === 'string' ? rawBaseUrl.trim() : '';
	const candidateBaseUrl = trimmedBaseUrl === '' ? 'https://uptimeify.io' : trimmedBaseUrl;

	let baseUrl: string;
	try {
		// A value that is present but not a URL at all (a typo, a stray word) would otherwise
		// reach the HTTP layer unchecked and fail there as a bare "Invalid URL" with nothing
		// pointing back at the credential that caused it. Catching it here, before it is used,
		// lets the error name the field and the bad value instead.
		new URL(candidateBaseUrl);
		baseUrl = candidateBaseUrl.replace(/\/+$/, '');
	} catch {
		throw new NodeOperationError(
			this.getNode(),
			`The Base URL credential value "${candidateBaseUrl}" is not a valid URL. Check the Base URL field on the Uptimeify API credential.`,
		);
	}

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		qs: cleanQuery(qs),
		headers: { Accept: 'application/json' },
		json: true,
	};

	if (body !== undefined) options.body = body;

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'uptimeifyApi', options);
	} catch (error) {
		const description = describeUptimeifyError(error);
		throw new NodeApiError(
			this.getNode(),
			error as JsonObject,
			description === undefined ? undefined : { description },
		);
	}
}

/**
 * Walks a list endpoint to its end, or to `limit` items, whichever comes first. `mode` picks the
 * pagination dialect: `page` uses page/perPage, `offset` uses limit/offset, `cursor` uses
 * limit/cursor, `array` means the endpoint answers with everything at once.
 */
export async function uptimeifyApiRequestAllItems(
	this: UptimeifyContext,
	path: string,
	qs: IDataObject,
	options: { mode: 'page' | 'offset' | 'cursor' | 'array'; limit?: number },
): Promise<IDataObject[]> {
	const { mode, limit } = options;
	const collected: IDataObject[] = [];

	if (mode === 'array') {
		const response = await uptimeifyApiRequest.call(this, 'GET', path, undefined, qs);
		const items = extractItems(response);
		return limit === undefined ? items : items.slice(0, limit);
	}

	if (mode === 'offset') {
		let offset = 0;

		for (;;) {
			const response = await uptimeifyApiRequest.call(this, 'GET', path, undefined, {
				...qs,
				limit: MAX_OFFSET_LIMIT,
				offset,
			});
			const items = extractItems(response);
			collected.push(...items);

			if (items.length < MAX_OFFSET_LIMIT) break;
			if (limit !== undefined && collected.length >= limit) break;
			offset += MAX_OFFSET_LIMIT;
		}

		return limit === undefined ? collected : collected.slice(0, limit);
	}

	if (mode === 'cursor') {
		let cursor: string | undefined;

		do {
			const pageSize =
				limit === undefined
					? MAX_CURSOR_LIMIT
					: Math.min(MAX_CURSOR_LIMIT, limit - collected.length);
			const response = await uptimeifyApiRequest.call(this, 'GET', path, undefined, {
				...qs,
				limit: pageSize,
				cursor,
			});
			const items = extractItems(response);
			collected.push(...items);

			const nextCursor =
				typeof response === 'object' && response !== null
					? (response as { nextCursor?: unknown }).nextCursor
					: undefined;
			cursor = typeof nextCursor === 'string' ? nextCursor : undefined;
			if (items.length === 0) break;
		} while (cursor !== undefined && (limit === undefined || collected.length < limit));

		return limit === undefined ? collected : collected.slice(0, limit);
	}

	let page = 1;

	for (;;) {
		const response = await uptimeifyApiRequest.call(this, 'GET', path, undefined, {
			...qs,
			page,
			perPage: MAX_PER_PAGE,
		});
		const items = extractItems(response);
		collected.push(...items);

		if (items.length < MAX_PER_PAGE) break;
		if (limit !== undefined && collected.length >= limit) break;
		page += 1;
	}

	return limit === undefined ? collected : collected.slice(0, limit);
}
