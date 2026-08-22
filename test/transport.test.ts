import { describe, expect, it } from 'vitest';
import type { IDataObject, IHttpRequestOptions, INode } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import {
	cleanQuery,
	extractItems,
	MAX_CURSOR_LIMIT,
	MAX_OFFSET_LIMIT,
	MAX_PER_PAGE,
	uptimeifyApiRequest,
	uptimeifyApiRequestAllItems,
} from '../nodes/Uptimeify/shared/transport';
import type { UptimeifyContext } from '../nodes/Uptimeify/shared/transport';

describe('cleanQuery', () => {
	it('drops undefined, null and empty strings but keeps false and zero', () => {
		expect(cleanQuery({ a: 1, b: undefined, c: null, d: '', e: 'x', f: false, g: 0 })).toEqual({
			a: 1,
			e: 'x',
			f: false,
			g: 0,
		});
	});

	it('keeps arrays so repeatable parameters survive', () => {
		expect(cleanQuery({ status: ['triggered', 'acknowledged'] })).toEqual({
			status: ['triggered', 'acknowledged'],
		});
	});
});

describe('extractItems', () => {
	it('unwraps a paged response', () => {
		expect(extractItems({ items: [{ id: 1 }], total: 1, page: 1, perPage: 50 })).toEqual([
			{ id: 1 },
		]);
	});

	it('passes a bare array through', () => {
		expect(extractItems([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
	});

	it('unwraps a data array, the shape the history endpoints answer with', () => {
		expect(extractItems({ data: [{ id: 'chk_1' }] })).toEqual([{ id: 'chk_1' }]);
	});

	it('returns an empty array for anything else', () => {
		expect(extractItems(null)).toEqual([]);
		expect(extractItems({ statusPage: { id: 1 } })).toEqual([]);
	});
});

/**
 * `uptimeifyApiRequestAllItems` calls `uptimeifyApiRequest` through a module-local binding, so
 * mocking the module export would not intercept it. Instead these tests build a fake `this`
 * context and drive the real request/pagination code through it end to end.
 */
type RequestHandler = (options: IHttpRequestOptions, callIndex: number) => unknown;

function createFakeNode(): INode {
	return {
		id: '1',
		name: 'Uptimeify',
		typeVersion: 1,
		type: 'n8n-nodes-uptimeify.uptimeify',
		position: [0, 0],
		parameters: {},
	};
}

function createContext(handler: RequestHandler): {
	context: UptimeifyContext;
	calls: IHttpRequestOptions[];
} {
	const calls: IHttpRequestOptions[] = [];
	const node = createFakeNode();

	const fakeContext = {
		getCredentials: async () => ({ apiToken: 'wsm_test', baseUrl: 'https://uptimeify.test' }),
		getNode: () => node,
		helpers: {
			httpRequestWithAuthentication: async (
				_credentialsType: string,
				options: IHttpRequestOptions,
			) => {
				const callIndex = calls.length;
				calls.push(options);
				return handler(options, callIndex);
			},
		},
	};

	return { context: fakeContext as unknown as UptimeifyContext, calls };
}

function items(count: number, offset = 0): IDataObject[] {
	return Array.from({ length: count }, (_, index) => ({ id: offset + index }));
}

describe('uptimeifyApiRequestAllItems - page mode', () => {
	it('stops after the first short page', async () => {
		const { context, calls } = createContext(() => ({ items: items(30) }));

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/monitors',
			{},
			{ mode: 'page' },
		);

		expect(calls).toHaveLength(1);
		expect(calls[0].qs).toMatchObject({ page: 1, perPage: MAX_PER_PAGE });
		expect(result).toHaveLength(30);
	});

	it('keeps paging while pages come back exactly full, returning everything when limit is undefined', async () => {
		const { context, calls } = createContext((_options, callIndex) => {
			if (callIndex === 0) return { items: items(MAX_PER_PAGE) };
			if (callIndex === 1) return { items: items(MAX_PER_PAGE, MAX_PER_PAGE) };
			return { items: items(80, MAX_PER_PAGE * 2) };
		});

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/monitors',
			{},
			{ mode: 'page' },
		);

		expect(calls).toHaveLength(3);
		expect(calls.map((call) => call.qs?.page)).toEqual([1, 2, 3]);
		expect(result).toHaveLength(MAX_PER_PAGE * 2 + 80);
	});

	it('issues exactly one request when limit is smaller than one page', async () => {
		const { context, calls } = createContext(() => ({ items: items(MAX_PER_PAGE) }));

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/monitors',
			{},
			{ mode: 'page', limit: 10 },
		);

		expect(calls).toHaveLength(1);
		expect(result).toHaveLength(10);
		expect(result).toEqual(items(10));
	});
});

describe('uptimeifyApiRequestAllItems - offset mode', () => {
	it('stops after the first short page', async () => {
		const { context, calls } = createContext(() => ({ items: items(30) }));

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/incidents',
			{},
			{ mode: 'offset' },
		);

		expect(calls).toHaveLength(1);
		expect(calls[0].qs).toMatchObject({ limit: MAX_OFFSET_LIMIT, offset: 0 });
		expect(result).toHaveLength(30);
	});

	it('keeps paging while pages come back exactly full, advancing offset by 500 each request', async () => {
		const { context, calls } = createContext((_options, callIndex) => {
			if (callIndex === 0) return { items: items(MAX_OFFSET_LIMIT) };
			if (callIndex === 1) return { items: items(MAX_OFFSET_LIMIT, MAX_OFFSET_LIMIT) };
			return { items: items(50, MAX_OFFSET_LIMIT * 2) };
		});

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/incidents',
			{},
			{ mode: 'offset' },
		);

		expect(calls).toHaveLength(3);
		expect(calls.map((call) => call.qs?.offset)).toEqual([
			0,
			MAX_OFFSET_LIMIT,
			MAX_OFFSET_LIMIT * 2,
		]);
		expect(result).toHaveLength(MAX_OFFSET_LIMIT * 2 + 50);
	});

	it('issues exactly one request when limit is smaller than one page', async () => {
		const { context, calls } = createContext(() => ({ items: items(MAX_OFFSET_LIMIT) }));

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/incidents',
			{},
			{ mode: 'offset', limit: 10 },
		);

		expect(calls).toHaveLength(1);
		expect(result).toHaveLength(10);
	});
});

describe('uptimeifyApiRequestAllItems - cursor mode', () => {
	it('follows nextCursor across pages', async () => {
		const { context, calls } = createContext((_options, callIndex) => {
			if (callIndex === 0) return { items: items(10), nextCursor: 'cursor-2' };
			return { items: items(5, 10) };
		});

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/incidents',
			{},
			{ mode: 'cursor' },
		);

		expect(calls).toHaveLength(2);
		expect(calls[1].qs).toMatchObject({ cursor: 'cursor-2' });
		expect(result).toHaveLength(15);
	});

	it('stops when nextCursor is absent', async () => {
		const { context, calls } = createContext(() => ({ items: items(10) }));

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/incidents',
			{},
			{ mode: 'cursor' },
		);

		expect(calls).toHaveLength(1);
		expect(result).toHaveLength(10);
	});

	it('stops when a page returns zero items even though a cursor is still present', async () => {
		const { context, calls } = createContext(() => ({ items: [], nextCursor: 'cursor-2' }));

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/incidents',
			{},
			{ mode: 'cursor' },
		);

		expect(calls).toHaveLength(1);
		expect(result).toEqual([]);
	});

	it('shrinks the per-request limit to the remaining need rather than always asking for 100', async () => {
		const { context, calls } = createContext((_options, callIndex) => {
			if (callIndex === 0) return { items: items(MAX_CURSOR_LIMIT), nextCursor: 'cursor-2' };
			return { items: items(50, MAX_CURSOR_LIMIT), nextCursor: 'cursor-3' };
		});

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/incidents',
			{},
			{ mode: 'cursor', limit: 150 },
		);

		expect(calls).toHaveLength(2);
		expect(calls[0].qs).toMatchObject({ limit: MAX_CURSOR_LIMIT });
		expect(calls[1].qs).toMatchObject({ limit: 50 });
		expect(result).toHaveLength(150);
	});

	it('terminates instead of throwing when a page body is null', async () => {
		const { context, calls } = createContext(() => null);

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/incidents',
			{},
			{ mode: 'cursor' },
		);

		expect(calls).toHaveLength(1);
		expect(result).toEqual([]);
	});
});

describe('uptimeifyApiRequestAllItems - array mode', () => {
	it('issues a single request and slices the result to limit', async () => {
		const { context, calls } = createContext(() => ({ items: items(50) }));

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/status-pages',
			{},
			{ mode: 'array', limit: 5 },
		);

		expect(calls).toHaveLength(1);
		expect(result).toHaveLength(5);
		expect(result).toEqual(items(5));
	});

	it('returns everything from a single request when limit is undefined', async () => {
		const { context, calls } = createContext(() => ({ items: items(50) }));

		const result = await uptimeifyApiRequestAllItems.call(
			context,
			'/status-pages',
			{},
			{ mode: 'array' },
		);

		expect(calls).toHaveLength(1);
		expect(result).toHaveLength(50);
	});
});

describe('uptimeifyApiRequest', () => {
	it('wraps a rejected request in a NodeApiError', async () => {
		const { context } = createContext(() => {
			throw new Error('network down');
		});

		await expect(
			uptimeifyApiRequest.call(context, 'GET', '/monitors', undefined, {}),
		).rejects.toBeInstanceOf(NodeApiError);
	});

	it('surfaces a known data.code as the NodeApiError description', async () => {
		const { context } = createContext(() => {
			throw {
				message: 'Request failed with status code 403',
				response: { body: { data: { code: 'imAccessDenied' } } },
			};
		});

		await expect(
			uptimeifyApiRequest.call(context, 'GET', '/monitors', undefined, {}),
		).rejects.toMatchObject({
			description:
				'Incident Management requires an organization-wide API token. A customer-scoped token is rejected.',
		});
	});
});
