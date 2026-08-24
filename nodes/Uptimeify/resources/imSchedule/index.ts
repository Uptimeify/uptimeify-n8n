import type { INodeProperties } from 'n8n-workflow';
import { returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['imSchedule'], operation: [operation] });

export const imScheduleDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		description:
			'Requires an organization-wide API token and an organization with Incident Management enabled',
		displayOptions: { show: { resource: ['imSchedule'] } },
		options: [
			{ name: 'Create Override', value: 'createOverride', action: 'Create a schedule override' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many schedules' },
		],
		default: 'getAll',
	},
	{
		displayName: 'Schedule ID',
		name: 'scheduleId',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 1,
		required: true,
		displayOptions: { show: show('createOverride') },
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. u_abc123',
		description: 'Has to belong to your organization',
		displayOptions: { show: show('createOverride') },
	},
	{
		displayName: 'Starts At',
		name: 'startsAt',
		type: 'dateTime',
		default: '',
		required: true,
		displayOptions: { show: show('createOverride') },
	},
	{
		displayName: 'Ends At',
		name: 'endsAt',
		type: 'dateTime',
		default: '',
		required: true,
		description: 'Has to be strictly after the start',
		displayOptions: { show: show('createOverride') },
	},
	...returnAllProperties('imSchedule', 'getAll'),
];
