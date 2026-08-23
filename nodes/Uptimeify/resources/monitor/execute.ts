import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { MONITOR_CONFIG_KEYS, MONITOR_PATHS } from '../../shared/descriptions';
import { splitList } from '../../shared/lists';
import { assertNonEmptyUpdateBody } from '../../shared/parse';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

type ExpectedValueEntry = { rrtype: string; values: string };

/**
 * Builds the type-specific config object under its own key, e.g. `dnsConfig` for DNS.
 *
 * `operation` defaults to `'create'` so existing callers that only care about the validation
 * behaviour (and every current test) keep exercising the strict, always-build path.
 */
export function buildConfig(
	context: IExecuteFunctions,
	monitorType: string,
	itemIndex: number,
	operation: string = 'create',
): IDataObject | undefined {
	if (monitorType === 'dns') {
		const entries = ((context.getNodeParameter('expectedValues', itemIndex) as IDataObject).value ??
			[]) as unknown as ExpectedValueEntry[];

		if (operation === 'update' && entries.length === 0) {
			// DNS's fields are top-level rather than tucked into one options collection, so there's
			// no single "did the user touch this" object to check the way the credentialed types do.
			// Expected Values is the one field every valid dnsConfig must have at least one row in -
			// RR Types and Match Mode both carry non-empty defaults ('A' / 'exact'), so they're always
			// "present" whether or not the user opened them, but Expected Values starts genuinely
			// empty and only gains a row when the user adds one. So its presence is used as the
			// signal that the user is actually (re-)supplying the DNS matching config; an empty
			// Expected Values on update means the user left the whole DNS block alone (e.g. only
			// renamed the monitor), and no dnsConfig should be sent at all.
			return undefined;
		}

		const rrtypes = context.getNodeParameter('rrtypes', itemIndex) as string[];

		const expectedValues: IDataObject = {};
		for (const entry of entries) {
			if (expectedValues[entry.rrtype] !== undefined) {
				throw new NodeOperationError(
					context.getNode(),
					`Expected Values has more than one row for RR type "${entry.rrtype}"`,
					{ itemIndex },
				);
			}

			const values = splitList(entry.values);
			if (values.length === 0) {
				throw new NodeOperationError(
					context.getNode(),
					`Expected Values for RR type "${entry.rrtype}" has no values`,
					{ itemIndex },
				);
			}

			expectedValues[entry.rrtype] = values;
		}

		for (const rrtype of rrtypes) {
			if (expectedValues[rrtype] === undefined) {
				throw new NodeOperationError(
					context.getNode(),
					`RR Types includes "${rrtype}" but Expected Values has no row for it`,
					{ itemIndex },
				);
			}
		}

		const options = context.getNodeParameter('dnsOptions', itemIndex) as IDataObject;

		return {
			rrtypes,
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
			// Set after the spread so the required top-level fields always win, even if the
			// user also filled in the commonFields collection's Name option.
			body.customerId = this.getNodeParameter('customerId', itemIndex, undefined, {
				extractValue: true,
			}) as string;
			body.name = this.getNodeParameter('name', itemIndex) as string;
			body.hostname = this.getNodeParameter('hostname', itemIndex) as string;

			if (monitorType === 'tcp') body.port = this.getNodeParameter('port', itemIndex) as number;
		}

		const isCredentialedType = ['smtp', 'ssh', 'ftp', 'imap-pop'].includes(monitorType);

		if (operation === 'create' && isCredentialedType) {
			// Only create sends `checkMode` unconditionally; on update it lives in `commonFields`
			// so a rename or other unrelated change doesn't silently flip the monitor back to
			// protocol mode (see below).
			body.checkMode = this.getNodeParameter('checkMode', itemIndex) as string;
		}

		// `checkMode === 'tcp'` - sent explicitly in this request - means no protocol config
		// is wanted: TCP mode stores no credentials. Otherwise (checkMode absent, set to
		// 'protocol', or not applicable to this monitor type at all) build the config from the
		// type-specific options collection and let `buildConfig` decide whether there's anything
		// to send - it returns `undefined` for an untouched/empty options collection, which means
		// the user isn't editing the config, so nothing about it should be sent. This keys off the
		// options the user actually filled in, not off whether `checkMode` happened to be included.
		if (body.checkMode !== 'tcp') {
			const config = buildConfig(this, monitorType, itemIndex, operation);
			if (config !== undefined) body[MONITOR_CONFIG_KEYS[monitorType]] = config;
		}

		if (operation === 'create') {
			return (await uptimeifyApiRequest.call(this, 'POST', basePath, body)) as IDataObject;
		}

		// Checked here, after commonFields is spread in and the type-specific config has (or has
		// not) been attached, so this sees exactly what would be sent. An empty body means either
		// nothing was touched at all, or - on a DNS monitor - only RR Types/Match Mode were
		// touched without adding an Expected Values row, which deliberately leaves dnsConfig
		// unbuilt (see buildConfig above). Either way an empty PATCH would report success on a
		// change that never happened, so both cases need the same actionable error instead of a
		// silent no-op.
		assertNonEmptyUpdateBody(
			this,
			body,
			'Common Fields',
			itemIndex,
			'Common Fields is empty and no monitor type options were included either. Fill in at ' +
				'least one field in Common Fields, or fill in the monitor type options (for DNS, add ' +
				'an Expected Values row), or nothing would change.',
		);

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
