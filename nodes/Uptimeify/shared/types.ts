import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

/**
 * Every resource module exports one of these. It returns raw objects; wrapping them into
 * `INodeExecutionData` and attaching `pairedItem` is the node's job, not the resource's.
 */
export type ResourceExecute = (
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
) => Promise<IDataObject | IDataObject[]>;
