import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { MONITOR_CONFIG_KEYS, MONITOR_PATHS } from '../../shared/descriptions';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

type ExpectedValueEntry = { rrtype: string; values: string };

function splitList(raw: string): string[] {
	return raw
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '');
}

/** Builds the type-specific config object under its own key, e.g. `dnsConfig` for DNS. */
function buildConfig(
	context: IExecuteFunctions,
	monitorType: string,
	itemIndex: number,
): IDataObject | undefined {
	if (monitorType === 'dns') {
		const entries = ((context.getNodeParameter('expectedValues', itemIndex) as IDataObject).value ??
			[]) as unknown as ExpectedValueEntry[];

		const expectedValues: IDataObject = {};
		for (const entry of entries) {
			expectedValues[entry.rrtype] = splitList(entry.values);
		}

		const options = context.getNodeParameter('dnsOptions', itemIndex) as IDataObject;

		return {
			rrtypes: context.getNodeParameter('rrtypes', itemIndex) as string[],
			matchMode: context.getNodeParameter('matchMode', itemIndex) as string,
			expectedValues,
			triggerOn: {
				resolveError: options.resolveError ?? true,
				mismatch: options.mismatch ?? true,
			},
		};
	}

	const optionParameter: Record<string, string> = {
		icmp: 'icmpOptions',
		tcp: 'tcpOptions',
		smtp: 'smtpOptions',
		ssh: 'sshOptions',
		ftp: 'ftpOptions',
		'imap-pop': 'imapPopOptions',
	};

	const parameterName = optionParameter[monitorType];
	if (parameterName === undefined) return undefined;

	const options = context.getNodeParameter(parameterName, itemIndex) as IDataObject;
	if (Object.keys(options).length === 0) return undefined;

	if (monitorType === 'smtp') {
		const { user, pass, ...rest } = options;
		return user === undefined && pass === undefined ? rest : { ...rest, auth: { user, pass } };
	}

	if (monitorType === 'ftp' && typeof options.secure === 'string') {
		const secure = options.secure === 'implicit' ? 'implicit' : options.secure === 'true';
		return { ...options, secure };
	}

	return options;
}

export const executeMonitor: ResourceExecute = async function (this, operation, itemIndex) {
	const monitorType = this.getNodeParameter('monitorType', itemIndex) as string;
	const basePath = MONITOR_PATHS[monitorType];

	if (basePath === undefined) {
		throw new NodeOperationError(this.getNode(), `Unknown monitor type "${monitorType}"`, {
			itemIndex,
		});
	}

	if (operation === 'create' || operation === 'update') {
		const common = this.getNodeParameter('commonFields', itemIndex) as IDataObject;
		const body: IDataObject = { ...common };

		if (operation === 'create') {
			body.customerId = this.getNodeParameter('customerId', itemIndex, undefined, {
				extractValue: true,
			}) as string;
			body.name = this.getNodeParameter('name', itemIndex) as string;
			body.hostname = this.getNodeParameter('hostname', itemIndex) as string;

			if (monitorType === 'tcp') body.port = this.getNodeParameter('port', itemIndex) as number;
		}

		if (['smtp', 'ssh', 'ftp', 'imap-pop'].includes(monitorType)) {
			body.checkMode = this.getNodeParameter('checkMode', itemIndex) as string;
		}

		if (body.checkMode !== 'tcp') {
			const config = buildConfig(this, monitorType, itemIndex);
			if (config !== undefined) body[MONITOR_CONFIG_KEYS[monitorType]] = config;
		}

		if (operation === 'create') {
			return (await uptimeifyApiRequest.call(this, 'POST', basePath, body)) as IDataObject;
		}

		const monitorId = this.getNodeParameter('monitorId', itemIndex, undefined, {
			extractValue: true,
		}) as string;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`${basePath}/${monitorId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			basePath,
			{},
			{
				mode: 'page',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const monitorId = this.getNodeParameter('monitorId', itemIndex, undefined, {
		extractValue: true,
	}) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(this, 'GET', `${basePath}/${monitorId}`)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `${basePath}/${monitorId}`);
		return { success: true, monitorId };
	}

	if (operation === 'triggerCheck') {
		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`${basePath}/${monitorId}/trigger-check`,
			{},
		)) as IDataObject;
	}

	const historyPaths: Record<string, string> = {
		getCheckHistory: 'check-history',
		getAlertHistory: 'alert-history',
		getIncidentHistory: 'incident-history',
	};

	const segment = historyPaths[operation];

	if (segment !== undefined) {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const limit = returnAll ? 200 : (this.getNodeParameter('limit', itemIndex) as number);

		const rows = await uptimeifyApiRequestAllItems.call(
			this,
			`${basePath}/${monitorId}/${segment}`,
			{ limit: Math.min(limit, 200) },
			{ mode: 'array', limit: returnAll ? undefined : limit },
		);

		return rows;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for monitors`,
		{ itemIndex },
	);
};
