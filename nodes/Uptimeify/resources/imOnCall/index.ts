import type { INodeProperties } from 'n8n-workflow';
import { returnAllProperties } from '../../shared/descriptions';

export const imOnCallDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		description:
			'Requires an organization-wide API token and an organization with Incident Management enabled',
		displayOptions: { show: { resource: ['imOnCall'] } },
		options: [{ name: 'Get Many', value: 'getAll', action: 'Get many on call assignments' }],
		default: 'getAll',
	},
	...returnAllProperties('imOnCall', 'getAll'),
];
