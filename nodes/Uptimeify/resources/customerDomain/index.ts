import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['customerDomain'], operation: [operation] });

export const customerDomainDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['customerDomain'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a customer domain' },
			{ name: 'Delete', value: 'delete', action: 'Delete a customer domain' },
			{ name: 'Get', value: 'get', action: 'Get a customer domain' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many customer domains' },
			{ name: 'Update', value: 'update', action: 'Update a customer domain' },
		],
		default: 'getAll',
	},

	{ ...customerLocator, displayOptions: { show: show('create') } },
	{
		displayName: 'Domain Name',
		name: 'domainName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. example.com',
		description: 'Domain without a protocol and without a path',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Domain ID',
		name: 'domainId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['customerDomain'], operation: ['delete', 'get', 'update'] },
		},
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['customerDomain'], operation: ['create', 'update'] },
		},
		options: [
			{
				displayName: 'Domain Name',
				name: 'domainName',
				type: 'string',
				default: '',
				description: 'Only used when updating',
			},
			{ displayName: 'Expiry Error Days', name: 'expiryErrorDays', type: 'number', default: 7 },
			{
				displayName: 'Expiry Warning Days',
				name: 'expiryWarningDays',
				type: 'number',
				default: 30,
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

	...returnAllProperties('customerDomain', 'getAll'),
];
