import crypto from 'node:crypto';

/** 32 random bytes, hex encoded. Stored on the channel and in the workflow's static data. */
export function createWebhookSecret(): string {
	return crypto.randomBytes(32).toString('hex');
}

/**
 * Uptimeify signs the exact bytes of the request body. Verify against the raw body, before any
 * parse and re-serialization, otherwise whitespace differences break the comparison.
 */
export function isValidSignature(
	rawBody: Buffer | string,
	headerValue: unknown,
	secret: string,
): boolean {
	if (typeof headerValue !== 'string' || headerValue === '') return false;

	const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
	const a = Buffer.from(expected, 'utf8');
	const b = Buffer.from(headerValue, 'utf8');

	// timingSafeEqual throws on differing lengths, so the length check comes first.
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}
