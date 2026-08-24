import type { INodeProperties, INodePropertyModeValidation } from 'n8n-workflow';

/**
 * Same shape as `lists.ts`' `PLAIN_DECIMAL_INTEGER` - plain decimal digits only, no exponential
 * notation, hex, sign or decimal point - so the "By ID" field can't hand back something
 * `Number()` would silently reinterpret (or, worse, turn a pasted UUID into `NaN`, which
 * `JSON.stringify` then turns into `null`, POSTing an explicitly null scope).
 */
const NUMERIC_ID_VALIDATION: INodePropertyModeValidation = {
	type: 'regex',
	properties: {
		regex: '^[0-9]+$',
		errorMessage: 'Not a valid numeric ID',
	},
};

export const MONITOR_TYPE_OPTIONS = [
	{ name: 'DNS', value: 'dns' },
	{ name: 'FTP', value: 'ftp' },
	{ name: 'ICMP (Ping)', value: 'icmp' },
	{ name: 'IMAP/POP', value: 'imap-pop' },
	{ name: 'SMTP', value: 'smtp' },
	{ name: 'SSH', value: 'ssh' },
	{ name: 'TCP Port', value: 'tcp' },
];

export const MONITOR_PATHS: Record<string, string> = {
	dns: '/api/dns-monitors',
	ftp: '/api/ftp-monitors',
	icmp: '/api/icmp-monitors',
	'imap-pop': '/api/imap-pop-monitors',
	smtp: '/api/smtp-monitors',
	ssh: '/api/ssh-monitors',
	tcp: '/api/tcp-monitors',
};

export const MONITOR_CONFIG_KEYS: Record<string, string> = {
	dns: 'dnsConfig',
	ftp: 'ftpConfig',
	icmp: 'icmpConfig',
	'imap-pop': 'imapPopConfig',
	smtp: 'smtpConfig',
	ssh: 'sshConfig',
	tcp: 'config',
};

function locator(
	displayName: string,
	name: string,
	searchListMethod: string,
	idPlaceholder: string,
	numericId?: boolean,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select from the list...',
				typeOptions: {
					searchListMethod,
					searchable: true,
					searchFilterRequired: false,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: idPlaceholder,
				validation: numericId === true ? [NUMERIC_ID_VALIDATION] : undefined,
			},
		],
	};
}

export const customerLocator = locator(
	'Customer',
	'customerId',
	'getCustomers',
	'e.g. 059e1469-0f05-4c93-bd4d-89c45bb2afd9',
);

export const websiteLocator = locator(
	'Website',
	'websiteId',
	'getWebsites',
	'e.g. 11111111-1111-4111-8111-111111111111',
);

export const monitorLocator = locator(
	'Monitor',
	'monitorId',
	'getMonitors',
	'e.g. 3d005a18-fdd8-4dc7-9f26-1a9d409c1bc5',
);

export const tagLocator = locator('Tag', 'tagId', 'getTags', 'e.g. 7', true);

export const teamLocator = locator('Team', 'teamId', 'getTeams', 'e.g. 3', true);

/**
 * `/api/notification-channels` (used by the Uptimeify Trigger to scope its webhook channel) only
 * accepts numeric IDs, unlike the endpoints the locators above point at, which resolve either the
 * numeric ID or the public UUID. These three exist purely so the trigger's pickers can hand back
 * the numeric ID from the same list endpoints as `customerLocator` / `websiteLocator` - they are
 * not a replacement for those, which the Uptimeify action node depends on returning the UUID. Do
 * not consolidate them.
 */
export const customerNumericLocator = locator(
	'Customer',
	'customerId',
	'getCustomersNumericId',
	'e.g. 42',
	true,
);

export const websiteNumericLocator = locator(
	'Website',
	'websiteId',
	'getWebsitesNumericId',
	'e.g. 17',
	true,
);

export const notificationChannelLocator = locator(
	'Source Channel',
	'sourceChannelId',
	'getNotificationChannels',
	'e.g. 5',
	true,
);

/**
 * The Return All / Limit pair, wired to one resource and operation.
 *
 * `cappedAt`, when given, names the hard ceiling the endpoint itself imposes (it has no
 * pagination beyond `limit`). It surfaces as a `hint` rather than in `description` because the
 * n8n-nodes-base lint rules for the `returnAll` and `limit` field names pin `description` to a
 * fixed string; `hint` is the field meant for exactly this kind of extra, field-specific note,
 * and it renders right under the control the user is setting - the same place the README's cap
 * documentation would otherwise be the only place to find it.
 */
export function returnAllProperties(
	resource: string,
	operation: string,
	cappedAt?: number,
): INodeProperties[] {
	const show = { resource: [resource], operation: [operation] };
	const hint = cappedAt === undefined ? undefined : `Capped at ${cappedAt} results`;

	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			hint,
			displayOptions: { show },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			default: 50,
			typeOptions: { minValue: 1 },
			description: 'Max number of results to return',
			hint,
			displayOptions: { show: { ...show, returnAll: [false] } },
		},
	];
}
