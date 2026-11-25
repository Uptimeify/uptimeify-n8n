import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['customer'], operation: [operation] });

export const customerDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['customer'] } },
		options: [
			{ name: 'Bulk Action', value: 'bulk', action: 'Run a bulk action on customers' },
			{ name: 'Create', value: 'create', action: 'Create a customer' },
			{ name: 'Get', value: 'get', action: 'Get a customer' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many customers' },
			{ name: 'Get SMS Usage', value: 'getSmsUsage', action: 'Get SMS usage' },
			{ name: 'Update', value: 'update', action: 'Update a customer' },
		],
		default: 'getAll',
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		required: true,
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Package Type',
		name: 'packageType',
		type: 'string',
		default: '',
		required: true,
		description: 'Package key or display name configured for your organization',
		displayOptions: { show: show('create') },
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
				displayName: 'Allow Self Service',
				name: 'allowSelfService',
				type: 'boolean',
				default: false,
				description: 'Whether the customer may create self-service monitors',
			},
			{
				displayName: 'Can Edit Managed',
				name: 'canEditManaged',
				type: 'boolean',
				default: false,
				description: 'Whether the customer may edit managed monitors',
			},
			{
				displayName: 'Max Self Service URLs',
				name: 'maxSelfServiceUrls',
				type: 'number',
				default: 0,
				description: 'Cap across all monitor types. Zero means inherit from the package.',
			},
			{
				displayName: 'Monthly Reports Enabled',
				name: 'monthlyReportsEnabled',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
				],
				default: 'active',
			},
		],
	},

	{
		...customerLocator,
		displayOptions: { show: { resource: ['customer'], operation: ['get', 'update'] } },
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
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
			},
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Package Type', name: 'packageType', type: 'string', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
				],
				default: 'active',
			},
		],
	},

	{
		displayName: 'Action',
		name: 'bulkAction',
		type: 'options',
		options: [
			{ name: 'Activate', value: 'activate' },
			{ name: 'Deactivate', value: 'deactivate' },
			{
				name: 'Delete',
				value: 'delete',
				description: 'Users bound only to a deleted customer are deactivated',
			},
			{ name: 'Set Monthly Reports', value: 'reports' },
			{ name: 'Set Package', value: 'package' },
		],
		default: 'activate',
		required: true,
		displayOptions: { show: show('bulk') },
	},
	{
		displayName: 'Monthly Reports Enabled',
		name: 'bulkReportsEnabled',
		type: 'boolean',
		default: true,
		displayOptions: { show: { ...show('bulk'), bulkAction: ['reports'] } },
	},
	{
		displayName: 'Package ID',
		name: 'bulkPackageId',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 1,
		required: true,
		description: 'Numeric ID of the package configuration to assign',
		displayOptions: { show: { ...show('bulk'), bulkAction: ['package'] } },
	},
	{
		displayName: 'Customer IDs',
		name: 'bulkCustomerIds',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 101,102,103',
		description: 'Comma-separated customer IDs, at most 200',
		displayOptions: { show: show('bulk') },
	},

	...returnAllProperties('customer', 'getAll'),
	{
		displayName: 'Minimal Fields',
		name: 'minimal',
		type: 'boolean',
		default: false,
		description:
			'Whether to return only ID, public ID, name, status and custom fields. Much smaller responses.',
		displayOptions: { show: show('getAll') },
	},
];
