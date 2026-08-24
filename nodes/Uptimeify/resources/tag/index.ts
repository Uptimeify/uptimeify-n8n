import type { INodeProperties } from 'n8n-workflow';
import { returnAllProperties, tagLocator } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['tag'], operation: [operation] });
const ASSIGNMENT = ['assign', 'remove'];

const COLOR_OPTIONS = [
	{ name: 'Amber', value: 'amber' },
	{ name: 'Blue', value: 'blue' },
	{ name: 'Gray', value: 'gray' },
	{ name: 'Green', value: 'green' },
	{ name: 'Indigo', value: 'indigo' },
	{ name: 'Pink', value: 'pink' },
	{ name: 'Red', value: 'red' },
	{ name: 'Slate', value: 'slate' },
	{ name: 'Teal', value: 'teal' },
	{ name: 'Violet', value: 'violet' },
];

export const tagDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['tag'] } },
		options: [
			{ name: 'Assign to Monitor', value: 'assign', action: 'Assign a tag to a monitor' },
			{ name: 'Create', value: 'create', action: 'Create a tag' },
			{ name: 'Delete', value: 'delete', action: 'Delete a tag' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many tags' },
			{ name: 'Remove From Monitor', value: 'remove', action: 'Remove a tag from a monitor' },
			{ name: 'Update', value: 'update', action: 'Update a tag' },
		],
		default: 'getAll',
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'Display label, at most 50 characters',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Color',
		name: 'color',
		type: 'options',
		options: COLOR_OPTIONS,
		default: 'blue',
		required: true,
		displayOptions: { show: show('create') },
	},

	{
		...tagLocator,
		displayOptions: {
			show: { resource: ['tag'], operation: ['assign', 'delete', 'remove', 'update'] },
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
			{
				displayName: 'Color',
				name: 'color',
				type: 'options',
				options: COLOR_OPTIONS,
				default: 'blue',
			},
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
		],
	},

	{
		displayName: 'Monitor Type',
		name: 'assignMonitorType',
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
		required: true,
		description:
			'Use Customer Domain for domain expiry monitors and Customer IP for DNSBL monitors',
		displayOptions: { show: { resource: ['tag'], operation: ASSIGNMENT } },
	},
	{
		displayName: 'Monitor ID',
		name: 'assignMonitorId',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 0,
		required: true,
		description: 'Numeric monitor ID. This endpoint does not accept public UUIDs.',
		displayOptions: { show: { resource: ['tag'], operation: ASSIGNMENT } },
	},

	...returnAllProperties('tag', 'getAll'),
];
