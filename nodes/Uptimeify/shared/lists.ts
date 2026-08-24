import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/** Splits a comma-separated field into trimmed, non-empty entries. */
export function splitList(raw: string): string[] {
	return raw
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '');
}

/**
 * Parses already-split entries into positive integers, throwing a `NodeOperationError` naming
 * the offending entry (and using `label` to say what kind of ID it was) the first time one isn't
 * a positive integer.
 */
const PLAIN_DECIMAL_INTEGER = /^[0-9]+$/;

export function parsePositiveIntegers(
	context: IExecuteFunctions,
	entries: string[],
	label: string,
	itemIndex: number,
): number[] {
	return entries.map((entry) => {
		// `Number()` also accepts JavaScript numeric syntax nobody typed here - exponential
		// notation ('1e3'), hex ('0x10'), a leading '+' - so entries are restricted to plain
		// decimal digits before being converted, not just checked with `Number.isInteger`.
		const value = Number(entry);
		if (!PLAIN_DECIMAL_INTEGER.test(entry) || !Number.isInteger(value) || value <= 0) {
			throw new NodeOperationError(
				context.getNode(),
				`${label} "${entry}" is not a positive integer`,
				{ itemIndex },
			);
		}
		return value;
	});
}
