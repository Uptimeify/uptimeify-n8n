import type { INodeProperties } from 'n8n-workflow';
import { returnAllProperties } from '../../shared/descriptions';

export const imTeamDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		description:
			'Requires an organization-wide API token and an organization with Incident Management enabled',
		displayOptions: { show: { resource: ['imTeam'] } },
		options: [{ name: 'Get Many', value: 'getAll', action: 'Get many teams' }],
		default: 'getAll',
	},
	...returnAllProperties('imTeam', 'getAll'),
];
