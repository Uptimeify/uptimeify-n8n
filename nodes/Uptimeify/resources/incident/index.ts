import type { INodeProperties } from 'n8n-workflow';
import { returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['incident'], operation: [operation] });

export const incidentDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['incident'] } },
		options: [
			{ name: 'Delete', value: 'delete', action: 'Delete a manual incident' },
			{ name: 'Get', value: 'get', action: 'Get an incident' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many incidents' },
		],
		default: 'getAll',
	},
	{
		displayName: 'Incident ID',
		name: 'incidentId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['incident'], operation: ['delete', 'get'] } },
	},
	...returnAllProperties('incident', 'getAll'),
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		options: [
			{ name: 'Any', value: '' },
			{ name: 'Manual (Status Page)', value: 'manual' },
			{ name: 'Monitor', value: 'monitor' },
		],
		default: '',
		description:
			'Manual incidents can be much older than the newest monitor incidents, so filtering keeps them from falling outside the window',
		displayOptions: { show: show('getAll') },
	},
];
