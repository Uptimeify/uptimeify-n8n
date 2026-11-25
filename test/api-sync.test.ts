import { describe, expect, it } from 'vitest';
import type { IExecuteFunctions, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';
import { customerDescription } from '../nodes/Uptimeify/resources/customer';
import { customerDomainDescription } from '../nodes/Uptimeify/resources/customerDomain';
import { customerIpDescription } from '../nodes/Uptimeify/resources/customerIp';
import { imIncidentDescription } from '../nodes/Uptimeify/resources/imIncident';
import { executeImSchedule } from '../nodes/Uptimeify/resources/imSchedule/execute';
import { executeMaintenanceWindow } from '../nodes/Uptimeify/resources/maintenanceWindow/execute';
import { maintenanceWindowDescription } from '../nodes/Uptimeify/resources/maintenanceWindow';
import { executeMonitor } from '../nodes/Uptimeify/resources/monitor/execute';
import { notificationChannelDescription } from '../nodes/Uptimeify/resources/notificationChannel';
import { executeStatusPage } from '../nodes/Uptimeify/resources/statusPage/execute';
import { statusPageDescription } from '../nodes/Uptimeify/resources/statusPage';
import { websiteDescription } from '../nodes/Uptimeify/resources/website';

/**
 * Pins the request shapes and option lists of 0.3.1 against what the Uptimeify API accepts. Same
 * fake `this` as the other execute tests; `response` is what every HTTP call answers with.
 */
function createExecuteContext(
	params: Record<string, unknown>,
	response: unknown = {},
): { context: IExecuteFunctions; calls: IHttpRequestOptions[] } {
	const calls: IHttpRequestOptions[] = [];

	const fakeContext = {
		getNode: () => ({
			id: '1',
			name: 'Uptimeify',
			typeVersion: 1,
			type: 'n8n-nodes-uptimeify.uptimeify',
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name: string) => params[name],
		getCredentials: async () => ({ apiToken: 'wsm_test', baseUrl: 'https://uptimeify.test' }),
		helpers: {
			httpRequestWithAuthentication: async (_type: string, options: IHttpRequestOptions) => {
				calls.push(options);
				return response;
			},
		},
	};

	return { context: fakeContext as unknown as IExecuteFunctions, calls };
}

/** Every property in a description, including those nested in collections. */
function flatten(properties: INodeProperties[]): INodeProperties[] {
	return properties.flatMap((property) => [
		property,
		...flatten(
			((property.options ?? []) as Array<INodeProperties & { values?: INodeProperties[] }>).flatMap(
				(option) => option.values ?? (option.displayName === undefined ? [] : [option]),
			),
		),
	]);
}

function fields(properties: INodeProperties[], name: string): INodeProperties[] {
	return flatten(properties).filter((property) => property.name === name);
}

function optionValues(property: INodeProperties): unknown[] {
	return ((property.options ?? []) as Array<{ value: unknown }>).map((option) => option.value);
}

/** Option names of one named collection, e.g. the Update Fields of a resource. */
function collectionFieldNames(properties: INodeProperties[], collection: string): string[] {
	return properties
		.filter((property) => property.name === collection)
		.flatMap((property) => (property.options ?? []) as INodeProperties[])
		.map((option) => option.name);
}

describe('schedule override create', () => {
	const base = {
		scheduleId: 4,
		userId: 'u_1',
		startsAt: '2026-12-01T00:00:00.000Z',
		endsAt: '2026-12-02T00:00:00.000Z',
	};

	it('sends the required type', async () => {
		const { context, calls } = createExecuteContext({
			...base,
			type: 'online',
			additionalFields: {},
		});

		await executeImSchedule.call(context, 'createOverride', 0);

		expect(calls[0].url).toBe('https://uptimeify.test/api/im/schedules/4/overrides');
		expect(calls[0].body).toEqual({ ...base, scheduleId: undefined, type: 'online' });
	});

	it('sends applyScope and coveredByUserIds as an array', async () => {
		const { context, calls } = createExecuteContext({
			...base,
			type: 'offline',
			additionalFields: { applyScope: 'all_teams', coveredByUserIds: ' u_2, u_3 ' },
		});

		await executeImSchedule.call(context, 'createOverride', 0);

		expect(calls[0].body).toMatchObject({
			type: 'offline',
			applyScope: 'all_teams',
			coveredByUserIds: ['u_2', 'u_3'],
		});
	});
});

describe('status page create customer', () => {
	it('looks up the numeric id for a customer UUID, which the endpoint does not accept', async () => {
		const { context, calls } = createExecuteContext(
			{ customerId: '059e1469-0f05-4c93-bd4d-89c45bb2afd9', name: 'Page', additionalFields: {} },
			{ id: 77 },
		);

		await executeStatusPage.call(context, 'create', 0);

		expect(calls).toHaveLength(2);
		expect(calls[0].url).toBe(
			'https://uptimeify.test/api/customers/059e1469-0f05-4c93-bd4d-89c45bb2afd9',
		);
		expect(calls[1].body).toEqual({ name: 'Page', customerId: 77 });
	});

	it('sends no customerId for a page of the whole organization', async () => {
		const { context, calls } = createExecuteContext({
			customerId: '',
			name: 'Org Page',
			additionalFields: {},
		});

		await executeStatusPage.call(context, 'create', 0);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toEqual({ name: 'Org Page' });
	});
});

describe('status page get many', () => {
	it('asks for the items envelope and returns its rows', async () => {
		const { context, calls } = createExecuteContext(
			{ returnAll: true },
			{ items: [{ id: 1 }, { id: 2 }], total: 2, page: 1, perPage: 2 },
		);

		const rows = await executeStatusPage.call(context, 'getAll', 0);

		expect(calls[0].qs).toEqual({ envelope: 'items' });
		expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
	});
});

describe('maintenance window get many', () => {
	it('makes one request even when the unpaged list is longer than a page', async () => {
		const windows = Array.from({ length: 250 }, (_, id) => ({ id }));
		const { context, calls } = createExecuteContext({ returnAll: true }, windows);

		const rows = await executeMaintenanceWindow.call(context, 'getAll', 0);

		expect(calls).toHaveLength(1);
		expect(rows).toHaveLength(250);
	});
});

describe('tcp monitor expectedState', () => {
	it('is sent top-level on create, not inside config', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'tcp',
			customerId: 'cust',
			name: 'Closed port',
			hostname: 'db.example.com',
			port: 5432,
			additionalFields: {},
			tcpOptions: { expectedState: 'down' },
		});

		await executeMonitor.call(context, 'create', 0);

		expect(calls[0].body).toMatchObject({ expectedState: 'down' });
		expect(calls[0].body).not.toHaveProperty('config');
	});

	it('alone is enough for an update and leaves the banner in config', async () => {
		const { context, calls } = createExecuteContext({
			monitorType: 'tcp',
			monitorId: 'mon',
			updateFields: {},
			tcpOptions: { expectedState: 'up', expectBanner: 'SSH' },
		});

		await executeMonitor.call(context, 'update', 0);

		expect(calls[0].body).toEqual({ expectedState: 'up', config: { expectBanner: 'SSH' } });
	});
});

describe('option lists match the API enums', () => {
	it('customer IP and customer domain status is active/disabled', () => {
		for (const description of [customerIpDescription, customerDomainDescription]) {
			const statuses = fields(description, 'status');
			expect(statuses).toHaveLength(2);
			for (const status of statuses) expect(optionValues(status)).toEqual(['active', 'disabled']);
		}
	});

	it('status page visibility has all four values', () => {
		const visibilities = fields(statusPageDescription, 'visibility');
		expect(visibilities).toHaveLength(2);
		for (const visibility of visibilities) {
			expect(optionValues(visibility).sort()).toEqual([
				'customer_members_only',
				'password_protected',
				'public',
				'sso_members_only',
			]);
		}
		expect(fields(statusPageDescription, 'accessPassword')).toHaveLength(2);
	});

	it('maintenance window targets include tcp', () => {
		expect(optionValues(fields(maintenanceWindowDescription, 'type')[0])).toContain('tcp');
	});

	it('website create and update offer expectedState up/down', () => {
		const states = fields(websiteDescription, 'expectedState');
		expect(states).toHaveLength(2);
		for (const state of states) expect(optionValues(state).sort()).toEqual(['down', 'up']);
	});
});

describe('fields the API does not accept are gone', () => {
	it('escalationPolicyId on IM incident create', () => {
		expect(fields(imIncidentDescription, 'escalationPolicyId')).toEqual([]);
	});

	it('priority on notification channel create and update', () => {
		expect(fields(notificationChannelDescription, 'priority')).toEqual([]);
	});

	it('ipFamily on customer IP update, while create keeps it', () => {
		expect(collectionFieldNames(customerIpDescription, 'updateFields')).not.toContain('ipFamily');
		expect(collectionFieldNames(customerIpDescription, 'additionalFields')).toContain('ipFamily');
	});

	it('domainName on customer domain update', () => {
		expect(collectionFieldNames(customerDomainDescription, 'updateFields')).not.toContain(
			'domainName',
		);
	});

	it('customer bulk offers exactly the API actions', () => {
		expect(optionValues(fields(customerDescription, 'bulkAction')[0]).sort()).toEqual([
			'activate',
			'deactivate',
			'delete',
			'package',
			'reports',
		]);
	});

	it('customDomainHostname on status page update, while create keeps it', () => {
		const update = collectionFieldNames(statusPageDescription, 'updateFields');
		const create = collectionFieldNames(statusPageDescription, 'additionalFields');
		expect(update).not.toContain('customDomainHostname');
		expect(create).toContain('customDomainHostname');
	});
});
