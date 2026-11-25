import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['maintenanceWindow'], operation: [operation] });
const WRITE = ['create', 'previewOccurrences'];

export const maintenanceWindowDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['maintenanceWindow'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a maintenance window' },
			{ name: 'Delete', value: 'delete', action: 'Delete a maintenance window' },
			{ name: 'Get', value: 'get', action: 'Get a maintenance window' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many maintenance windows' },
			{
				name: 'Preview Occurrences',
				value: 'previewOccurrences',
				action: 'Preview maintenance window occurrences',
			},
			{ name: 'Update', value: 'update', action: 'Update a maintenance window' },
		],
		default: 'getAll',
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['maintenanceWindow'], operation: WRITE } },
	},
	{
		displayName: 'Start Time',
		name: 'startTime',
		type: 'dateTime',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['maintenanceWindow'], operation: WRITE } },
	},
	{
		displayName: 'End Time',
		name: 'endTime',
		type: 'dateTime',
		default: '',
		required: true,
		description: 'Has to be after the start time',
		displayOptions: { show: { resource: ['maintenanceWindow'], operation: WRITE } },
	},
	{
		displayName: 'Targeting',
		name: 'targeting',
		type: 'options',
		options: [
			{ name: 'Customer', value: 'customer', description: 'Every monitor of one customer' },
			{ name: 'Monitors', value: 'targets', description: 'An explicit list of monitors' },
			{
				name: 'Tags',
				value: 'tags',
				description: 'Every monitor across the organization carrying these tags',
			},
		],
		default: 'targets',
		required: true,
		description: 'Exactly one targeting mode has to be used',
		displayOptions: { show: { resource: ['maintenanceWindow'], operation: WRITE } },
	},
	{
		...customerLocator,
		displayOptions: {
			show: {
				resource: ['maintenanceWindow'],
				operation: WRITE,
				targeting: ['customer'],
			},
		},
	},
	{
		displayName: 'Targets',
		name: 'targets',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Target',
		default: {},
		displayOptions: {
			show: { resource: ['maintenanceWindow'], operation: WRITE, targeting: ['targets'] },
		},
		options: [
			{
				displayName: 'Target',
				name: 'target',
				values: [
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: [
							{ name: 'Customer Domain', value: 'customer_domain' },
							{ name: 'Customer IP', value: 'customer_ip' },
							{ name: 'DNS', value: 'dns' },
							{ name: 'FTP', value: 'ftp' },
							{ name: 'ICMP', value: 'icmp' },
							{ name: 'IMAP/POP', value: 'imap_pop' },
							{ name: 'SMTP', value: 'smtp' },
							{ name: 'SSH', value: 'ssh' },
							{ name: 'TCP', value: 'tcp' },
							{ name: 'Website', value: 'website' },
						],
						default: 'website',
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						default: '',
						description: 'Public UUID of the monitor. A numeric row ID is also accepted.',
					},
				],
			},
		],
	},
	{
		displayName: 'Tag IDs',
		name: 'tagIds',
		type: 'string',
		default: '',
		placeholder: 'e.g. 7,12',
		description: 'Comma-separated numeric tag IDs',
		displayOptions: {
			show: { resource: ['maintenanceWindow'], operation: WRITE, targeting: ['tags'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['maintenanceWindow'], operation: WRITE } },
		options: [
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			{ displayName: 'Is Active', name: 'isActive', type: 'boolean', default: true },
			{ displayName: 'Is Recurring', name: 'isRecurring', type: 'boolean', default: false },
		],
	},

	{
		displayName: 'Maintenance Window ID',
		name: 'maintenanceWindowId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['maintenanceWindow'], operation: ['delete', 'get', 'update'] },
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('update') },
		options: [
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			{ displayName: 'End Time', name: 'endTime', type: 'dateTime', default: '' },
			{ displayName: 'Is Active', name: 'isActive', type: 'boolean', default: true },
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Start Time', name: 'startTime', type: 'dateTime', default: '' },
		],
	},

	...returnAllProperties('maintenanceWindow', 'getAll'),
];
