import { describe, expect, it } from 'vitest';
import { describeUptimeifyError } from '../nodes/Uptimeify/shared/errors';

describe('describeUptimeifyError', () => {
	it('reads a known code from an httpRequest error body', () => {
		const error = { response: { body: { data: { code: 'imAccessDenied' } } } };

		expect(describeUptimeifyError(error)).toBe(
			'Incident Management requires an organization-wide API token. A customer-scoped token is rejected.',
		);
	});

	it('reads a known code from a nested error property', () => {
		const error = { error: { data: { code: 'notManualIncident' } } };

		expect(describeUptimeifyError(error)).toBe(
			'Only manually created incidents can be deleted. Monitor-generated incidents are owned by the workers.',
		);
	});

	it('lists the rejected fields from data.issues for invalidRequestBody', () => {
		const error = {
			response: {
				body: {
					data: {
						code: 'invalidRequestBody',
						issues: [
							{ path: 'ids', message: 'Invalid input: expected array, received undefined' },
							{ path: '', message: 'No fields provided' },
						],
					},
				},
			},
		};

		expect(describeUptimeifyError(error)).toBe(
			'The API rejected the request: ids: Invalid input: expected array, received undefined; No fields provided',
		);
	});

	it('falls back to a generic text when invalidRequestBody carries no issues', () => {
		const error = { response: { body: { data: { code: 'invalidRequestBody' } } } };

		expect(describeUptimeifyError(error)).toBe(
			'The API rejected the request: a field is missing or has the wrong type.',
		);
	});

	it.each([
		'expectedStateNotSupported',
		'targetHostMonitorLimitReached',
		'targetHostPlatformLimitReached',
		'monitorAlreadyExists',
	])('has a text for %s', (code) => {
		expect(describeUptimeifyError({ error: { data: { code } } })).toEqual(expect.any(String));
	});

	it('returns undefined for an unknown code', () => {
		const error = { response: { body: { data: { code: 'somethingNew' } } } };

		expect(describeUptimeifyError(error)).toBeUndefined();
	});

	it('returns undefined when there is no code at all', () => {
		expect(describeUptimeifyError({ message: 'socket hang up' })).toBeUndefined();
		expect(describeUptimeifyError(undefined)).toBeUndefined();
		expect(describeUptimeifyError('nope')).toBeUndefined();
	});
});
