import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string) => ({ resource: ['imOnCall'], operation: [operation] });

export const imOnCallDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		description:
			'Requires an organization-wide API token and an organization with Incident Management enabled',
		displayOptions: { show: { resource: ['imOnCall'] } },
		options: [
			{
				name: 'Create Schedule Override',
				value: 'createOverride',
				action: 'Create a schedule override',
			},
			{ name: 'Get Schedules', value: 'getSchedules', action: 'Get on call schedules' },
			{ name: 'Get Teams', value: 'getTeams', action: 'Get teams' },
			{ name: 'Who Is on Call', value: 'whoIsOnCall', action: 'Get who is on call' },
		],
		default: 'whoIsOnCall',
	},
	{
		displayName: 'Schedule ID',
		name: 'scheduleId',
		type: 'number',
		default: 0,
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
];
