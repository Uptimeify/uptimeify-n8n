import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({
	resource: ['notificationChannel'],
	operation: [operation],
});

export const notificationChannelDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['notificationChannel'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a notification channel' },
			{ name: 'Delete', value: 'delete', action: 'Delete a notification channel' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many notification channels' },
			{ name: 'Test', value: 'test', action: 'Test a notification channel' },
			{ name: 'Update', value: 'update', action: 'Update a notification channel' },
		],
		default: 'getAll',
	},

	{
		displayName: 'Type',
		name: 'type',
		type: 'string',
		default: 'webhook',
		required: true,
		placeholder: 'e.g. webhook, email, slack, pagerduty',
		description:
			'Direct types are email, sms and webhook. Integration types include slack, discord, teams, pagerduty, opsgenie, telegram, jira and more.',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Config',
		name: 'config',
		type: 'json',
		default: '{}',
		required: true,
		description:
			'Channel configuration. The fields depend on the type, e.g. a target URL for a webhook or { "secret": "https://hooks.slack.com/..." } for Slack.',
		displayOptions: {
			show: { resource: ['notificationChannel'], operation: ['create', 'test'] },
		},
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
				displayName: 'Category',
				name: 'category',
				type: 'options',
				options: [
					{ name: 'Direct', value: 'direct' },
					{ name: 'Integration', value: 'integration' },
				],
				default: 'direct',
			},
			{ ...customerLocator, required: false },
			{ displayName: 'Delay (Seconds)', name: 'delaySeconds', type: 'number', default: 0 },
			{ displayName: 'Is Active', name: 'isActive', type: 'boolean', default: true },
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'number',
				default: 1,
				description: 'Lower numbers are higher priority',
			},
		],
	},

	{
		displayName: 'Channel ID',
		name: 'channelId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['notificationChannel'], operation: ['delete', 'update'] },
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
			{ displayName: 'Config (JSON)', name: 'config', type: 'json', default: '{}' },
			{ displayName: 'Delay (Seconds)', name: 'delaySeconds', type: 'number', default: 0 },
			{ displayName: 'Is Active', name: 'isActive', type: 'boolean', default: true },
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Priority', name: 'priority', type: 'number', default: 1 },
		],
	},
	{
		displayName: 'Type',
		name: 'testType',
		type: 'string',
		default: 'webhook',
		required: true,
		description: 'Incident Management channels cannot be tested',
		displayOptions: { show: show('test') },
	},

	...returnAllProperties('notificationChannel', 'getAll'),
];
