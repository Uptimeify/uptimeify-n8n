import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/**
 * Parses a JSON parameter, turning a malformed JSON string into a `NodeOperationError`
 * naming the field instead of a raw `SyntaxError`.
 *
 * @param context execution context (used for error context)
 * @param raw the raw parameter (string or already-parsed object)
 * @param fieldName the name of the field being parsed (used in error messages)
 * @param itemIndex the index of the current item being processed
 * @returns parsed JSON object, or the original object if raw is not a string
 */
export function parseJsonParameter(
	context: IExecuteFunctions,
	raw: unknown,
	fieldName: string,
	itemIndex: number,
): IDataObject {
	if (typeof raw !== 'string') return (raw ?? {}) as IDataObject;

	try {
		return JSON.parse(raw) as IDataObject;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new NodeOperationError(context.getNode(), `${fieldName} is not valid JSON: ${reason}`, {
			itemIndex,
		});
	}
}
