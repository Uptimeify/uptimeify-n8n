import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['customerIp'], operation: [operation] });

export const customerIpDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['customerIp'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a customer IP' },
			{ name: 'Delete', value: 'delete', action: 'Delete a customer IP' },
			{ name: 'Get', value: 'get', action: 'Get a customer IP' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many customer IP addresses' },
			{ name: 'Update', value: 'update', action: 'Update a customer IP' },
		],
		default: 'getAll',
	},

	{ ...customerLocator, displayOptions: { show: show('create') } },
	{
		displayName: 'IP Address',
		name: 'ipAddress',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 203.0.113.10',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'IP ID',
		name: 'ipId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['customerIp'], operation: ['delete', 'get', 'update'] } },
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
				displayName: 'IP Family',
				name: 'ipFamily',
				type: 'options',
				options: [
					{ name: 'IPv4', value: 'v4' },
					{ name: 'IPv6', value: 'v6' },
				],
				default: 'v4',
				description: 'Inferred from the address when omitted. Has to match the address.',
			},
			{ displayName: 'Label', name: 'label', type: 'string', default: '' },
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
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('update') },
		options: [
			{
				displayName: 'IP Family',
				name: 'ipFamily',
				type: 'options',
				options: [
					{ name: 'IPv4', value: 'v4' },
					{ name: 'IPv6', value: 'v6' },
				],
				default: 'v4',
				description: 'Inferred from the address when omitted. Has to match the address.',
			},
			{ displayName: 'Label', name: 'label', type: 'string', default: '' },
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

	...returnAllProperties('customerIp', 'getAll'),
];
