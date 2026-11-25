export const UPTIMEIFY_ERROR_MESSAGES: Record<string, string> = {
	managed_by_organization:
		'This monitor is managed by the organization. Open a change request instead of editing it directly.',
	selfServiceNotAllowed: 'Self-service monitors are disabled for this customer.',
	selfServiceQuotaReached:
		'The customer has reached its self-service monitor quota. The quota counts all monitor types together.',
	managementTypeOrgOnly:
		'Only an organization admin can move a monitor between managed and self-service.',
	tooManyOpenRequests: 'The customer already has 10 open change requests.',
	invalidPackageType: 'The package does not belong to this organization.',
	portRequiredForTcp: 'An IMAP/POP monitor in TCP check mode needs an explicit port.',
	invalidCheckMode: 'Check mode has to be either "protocol" or "tcp".',
	notManualIncident:
		'Only manually created incidents can be deleted. Monitor-generated incidents are owned by the workers.',
	imAccessDenied:
		'Incident Management requires an organization-wide API token. A customer-scoped token is rejected.',
	imNotEnabled: 'Incident Management is not enabled for this organization.',
	imTeamWriteDenied: 'You need admin rights on this team to write to it.',
	imScheduleNotFound: 'This schedule does not exist in your organization.',
	invalidWindow: 'The end time has to be after the start time.',
	payloadTooLarge: 'The event payload is larger than 256 KB.',
	payloadTooDeep: 'The event payload is nested deeper than 20 levels.',
	organizationIdRequired: 'The organization could not be resolved from the API token.',
	invalidRequestBody: 'The API rejected the request: a field is missing or has the wrong type.',
	expectedStateNotSupported:
		'Expected State "Down" is only supported for heartbeat and TCP monitors.',
	targetHostMonitorLimitReached:
		'Your organization has reached the monitor limit for this target host. Remove monitors for this host or contact support.',
	targetHostPlatformLimitReached:
		'This target host has reached the platform-wide monitor limit. Contact support if you need to monitor it.',
	monitorAlreadyExists: 'This customer already has a monitor of this type for the same target.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function readData(value: unknown): Record<string, unknown> | undefined {
	if (!isRecord(value)) return undefined;

	const data = value.data;
	return isRecord(data) && typeof data.code === 'string' ? data : undefined;
}

/** `invalidRequestBody` carries `issues: [{ path, message }]` naming the rejected fields. */
function describeIssues(issues: unknown): string | undefined {
	if (!Array.isArray(issues)) return undefined;

	const lines = issues
		.filter(isRecord)
		.map((issue) => [issue.path, issue.message].filter((part) => part).join(': '))
		.filter((line) => line !== '');

	return lines.length === 0 ? undefined : `The API rejected the request: ${lines.join('; ')}`;
}

/**
 * Uptimeify puts a machine-readable reason in `data.code`. Depending on where the failure is
 * caught, that object sits under `response.body`, under `error`, or at the top level, so all
 * three are checked.
 */
export function describeUptimeifyError(error: unknown): string | undefined {
	if (!isRecord(error)) return undefined;

	const response = error.response;
	const candidates: unknown[] = [
		isRecord(response) ? response.body : undefined,
		error.error,
		error.body,
		error,
	];

	for (const candidate of candidates) {
		const data = readData(candidate);
		if (data === undefined) continue;

		const code = data.code as string;
		const issues = code === 'invalidRequestBody' ? describeIssues(data.issues) : undefined;
		if (issues !== undefined) return issues;
		if (code in UPTIMEIFY_ERROR_MESSAGES) return UPTIMEIFY_ERROR_MESSAGES[code];
	}

	return undefined;
}
