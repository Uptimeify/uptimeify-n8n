import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['statusPage'], operation: [operation] });

export const statusPageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['statusPage'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a status page' },
			{ name: 'Delete', value: 'delete', action: 'Delete a status page' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many status pages' },
			{ name: 'Update', value: 'update', action: 'Update a status page' },
		],
		default: 'getAll',
	},

	{ ...customerLocator, displayOptions: { show: show('create') } },
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'Display name, 1 to 120 characters. The slug is derived from it.',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Status Page ID',
		name: 'statusPageId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['statusPage'], operation: ['delete', 'update'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('create') },
		options: [
			{
				displayName: 'Custom Domain Hostname',
				name: 'customDomainHostname',
				type: 'string',
				default: '',
				description: 'Creates a pending DNS verification record',
			},
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			{ displayName: 'Is Published', name: 'isPublished', type: 'boolean', default: true },
			{
				displayName: 'Show Recent Incidents',
				name: 'showRecentIncidents',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'Show Recent Maintenance',
				name: 'showRecentMaintenance',
				type: 'boolean',
				default: false,
			},
			{ displayName: 'Slug', name: 'slug', type: 'string', default: '' },
			{
				displayName: 'Visibility',
				name: 'visibility',
				type: 'options',
				options: [
					{ name: 'Customer Members Only', value: 'customer_members_only' },
					{ name: 'Public', value: 'public' },
				],
				default: 'public',
			},
		],
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('update') },
		options: [
			{
				displayName: 'Custom Domain Hostname',
				name: 'customDomainHostname',
				type: 'string',
				default: '',
				description: 'Creates a pending DNS verification record',
			},
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			{ displayName: 'Is Published', name: 'isPublished', type: 'boolean', default: true },
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{
				displayName: 'Show Recent Incidents',
				name: 'showRecentIncidents',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'Show Recent Maintenance',
				name: 'showRecentMaintenance',
				type: 'boolean',
				default: false,
			},
			{ displayName: 'Slug', name: 'slug', type: 'string', default: '' },
			{
				displayName: 'Visibility',
				name: 'visibility',
				type: 'options',
				options: [
					{ name: 'Customer Members Only', value: 'customer_members_only' },
					{ name: 'Public', value: 'public' },
				],
				default: 'public',
			},
		],
	},

	...returnAllProperties('statusPage', 'getAll'),
];
