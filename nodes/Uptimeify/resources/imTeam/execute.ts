import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeImTeam: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/im/teams',
			{},
			{
				mode: 'array',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for teams`,
		{ itemIndex },
	);
};
