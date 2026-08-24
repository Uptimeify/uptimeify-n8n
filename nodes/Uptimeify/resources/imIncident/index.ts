import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties, teamLocator } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['imIncident'], operation: [operation] });

export const imIncidentDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		description:
			'Requires an organization-wide API token and an organization with Incident Management enabled',
		displayOptions: { show: { resource: ['imIncident'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create an incident' },
			{ name: 'Get', value: 'get', action: 'Get an incident' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many incidents' },
			{ name: 'Ingest Event', value: 'ingestEvent', action: 'Ingest an alert event' },
			{ name: 'Resolve', value: 'resolve', action: 'Resolve an incident' },
			{ name: 'Update Status', value: 'updateStatus', action: 'Update an incident status' },
		],
		default: 'getAll',
	},

	{
		displayName: 'Payload',
		name: 'payload',
		type: 'json',
		default: '{}',
		required: true,
		description:
			'Any JSON your alerting system produces. At most 256 KB and 20 levels deep. The endpoint answers 202 without an incident ID; processing is asynchronous.',
		displayOptions: { show: show('ingestEvent') },
	},

	{ ...teamLocator, displayOptions: { show: show('create') } },
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		required: true,
		description: 'Up to 10,000 characters',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Severity',
		name: 'severity',
		type: 'options',
		options: [
			{ name: 'SEV1', value: 'sev1' },
			{ name: 'SEV2', value: 'sev2' },
			{ name: 'SEV3', value: 'sev3' },
			{ name: 'SEV4', value: 'sev4' },
		],
		default: 'sev3',
		required: true,
		description: 'A manual incident has no alert stream to derive severity from',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('create') },
		options: [
			{ ...customerLocator, required: false },
			{
				displayName: 'Escalation Policy ID',
				name: 'escalationPolicyId',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				description: "Omit to use the team's default policy",
			},
		],
	},

	{
		displayName: 'Incident ID',
		name: 'incidentId',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 0,
		required: true,
		displayOptions: {
			show: { resource: ['imIncident'], operation: ['get', 'resolve', 'updateStatus'] },
		},
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: [
			{ name: 'Acknowledged', value: 'acknowledged' },
			{ name: 'Identified', value: 'identified' },
			{ name: 'Investigating', value: 'investigating' },
			{ name: 'Monitoring', value: 'monitoring' },
		],
		default: 'acknowledged',
		required: true,
		description: 'Resolving needs the Resolve operation; this one never reaches resolved',
		displayOptions: { show: show('updateStatus') },
	},
	{
		displayName: 'Note',
		name: 'note',
		type: 'string',
		default: '',
		description: 'Optional resolution note, up to 10,000 characters',
		displayOptions: { show: show('resolve') },
	},

	...returnAllProperties('imIncident', 'getAll'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: show('getAll') },
		options: [
			{
				displayName: 'From',
				name: 'from',
				type: 'dateTime',
				default: '',
				description: 'Only incidents triggered at or after this time',
			},
			{
				displayName: 'On Call',
				name: 'onCall',
				type: 'boolean',
				default: false,
				description: 'Whether to restrict to teams you are currently on call for',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Full-text search on the title, whole words only',
			},
			{
				displayName: 'Severity',
				name: 'severity',
				type: 'multiOptions',
				options: [
					{ name: 'SEV1', value: 'sev1' },
					{ name: 'SEV2', value: 'sev2' },
					{ name: 'SEV3', value: 'sev3' },
					{ name: 'SEV4', value: 'sev4' },
				],
				default: [],
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: [
					{ name: 'Acknowledged', value: 'acknowledged' },
					{ name: 'Identified', value: 'identified' },
					{ name: 'Investigating', value: 'investigating' },
					{ name: 'Merged', value: 'merged' },
					{ name: 'Monitoring', value: 'monitoring' },
					{ name: 'Resolved', value: 'resolved' },
					{ name: 'Triggered', value: 'triggered' },
				],
				default: [],
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'dateTime',
				default: '',
				description: 'Only incidents triggered at or before this time',
			},
		],
	},
];
