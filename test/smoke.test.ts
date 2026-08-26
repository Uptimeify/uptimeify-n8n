import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

describe('package manifest', () => {
	it('has no runtime dependencies', () => {
		expect((packageJson as { dependencies?: Record<string, string> }).dependencies).toBeUndefined();
	});

	it('registers two nodes and one credential', () => {
		expect(packageJson.n8n.nodes).toHaveLength(2);
		expect(packageJson.n8n.credentials).toHaveLength(1);
	});
});
