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
export function parsePositiveIntegers(
	context: IExecuteFunctions,
	entries: string[],
	label: string,
	itemIndex: number,
): number[] {
	return entries.map((entry) => {
		const value = Number(entry);
		if (!Number.isInteger(value) || value <= 0) {
			throw new NodeOperationError(
				context.getNode(),
				`${label} "${entry}" is not a positive integer`,
				{ itemIndex },
			);
		}
		return value;
	});
}
