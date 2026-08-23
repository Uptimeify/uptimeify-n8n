import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createWebhookSecret, isValidSignature } from '../nodes/UptimeifyTrigger/shared/signature';

const SECRET = 'top-secret';
const BODY = '{"type":"alert","incident_id":8094}';

function sign(body: string, secret: string): string {
	return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('isValidSignature', () => {
	it('accepts a signature over the exact bytes', () => {
		expect(isValidSignature(Buffer.from(BODY), sign(BODY, SECRET), SECRET)).toBe(true);
	});

	it('rejects a signature made with another secret', () => {
		expect(isValidSignature(Buffer.from(BODY), sign(BODY, 'other'), SECRET)).toBe(false);
	});

	it('rejects a body that differs by whitespace', () => {
		const reserialized = JSON.stringify(JSON.parse(BODY), null, 2);

		expect(isValidSignature(Buffer.from(reserialized), sign(BODY, SECRET), SECRET)).toBe(false);
	});

	it('rejects a missing or malformed header without throwing', () => {
		expect(isValidSignature(Buffer.from(BODY), undefined, SECRET)).toBe(false);
		expect(isValidSignature(Buffer.from(BODY), '', SECRET)).toBe(false);
		expect(isValidSignature(Buffer.from(BODY), 'short', SECRET)).toBe(false);
		expect(isValidSignature(Buffer.from(BODY), ['a', 'b'], SECRET)).toBe(false);
	});
});

describe('createWebhookSecret', () => {
	it('returns 64 hex characters', () => {
		expect(createWebhookSecret()).toMatch(/^[0-9a-f]{64}$/);
	});

	it('does not repeat itself', () => {
		expect(createWebhookSecret()).not.toBe(createWebhookSecret());
	});
});
