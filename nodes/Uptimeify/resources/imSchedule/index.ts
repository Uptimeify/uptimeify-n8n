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
		displayName: 'Type',
		name: 'type',
		type: 'options',
		options: [
			{ name: 'Offline', value: 'offline', description: 'Takes the user off call' },
			{ name: 'Online', value: 'online', description: 'Puts the user on call' },
		],
		default: 'online',
		required: true,
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
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('createOverride') },
		options: [
			{
				displayName: 'Apply Scope',
				name: 'applyScope',
				type: 'options',
				options: [
					{ name: 'All Teams', value: 'all_teams' },
					{ name: 'This Team', value: 'this_team' },
				],
				default: 'this_team',
			},
			{
				displayName: 'Covered By User IDs',
				name: 'coveredByUserIds',
				type: 'string',
				default: '',
				placeholder: 'e.g. u_abc123,u_def456',
				description:
					'Comma-separated IDs of the users who hold the pager instead. Offline overrides only.',
			},
		],
	},
	...returnAllProperties('imSchedule', 'getAll'),
];
