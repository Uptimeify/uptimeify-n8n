# n8n Nodes für Uptimeify — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drei n8n-Community-Nodes für Uptimeify (Action, Trigger, Tools), veröffentlicht auf npm und eingereicht zur Verifizierung im n8n Creator Portal.

**Architecture:** Programmatische Nodes. Ein geteilter HTTP-Transport kapselt Base URL, Authentifizierung, die drei Pagination-Formen der API und die Übersetzung von `data.code`-Fehlern. Jede Ressource liegt in einem eigenen Verzeichnis mit einer `description` (Property-Definitionen für die Oberfläche) und einer `execute`-Funktion (Request-Aufbau). Der Node selbst ist nur ein Router.

**Tech Stack:** TypeScript 5.9, `n8n-workflow` 2.35, `@n8n/node-cli` 0.44 (build/lint/dev/release), Vitest für reine Funktionen, `node:crypto` für HMAC.

**Spec:** `docs/superpowers/specs/2026-08-22-n8n-nodes-uptimeify-design.md`

## Global Constraints

- Paketname `@haupt-pascal/n8n-nodes-uptimeify`, Keyword `n8n-community-node-package`.
- **Keine Runtime-Dependencies.** `dependencies` in `package.json` bleibt leer oder fehlt. Nur `node:crypto` und `n8n-workflow` (peer) sind erlaubt. Vitest ist devDependency.
- Prettier aus `.prettierrc.js`: Tabs, Tab-Breite 2, einfache Anführungszeichen, Semikolons, `trailingComma: 'all'`, `printWidth: 100`.
- TypeScript `strict: true`. Kein `any`. Kein `@ts-ignore`, kein `eslint-disable` ohne begründenden Kommentar in derselben Zeile.
- ESLint kommt aus `@n8n/node-cli/eslint` und wird **nicht** verändert — sonst entfällt die Cloud-Eignung.
- Alle Anzeigetexte (`displayName`, `description`, `placeholder`) auf **Englisch**, Title Case bei `displayName`, `description` ohne Schlusspunkt.
- Optionale Query-Parameter werden weggelassen, nie als leerer String gesendet.
- Basis-URL kommt aus dem Credential (`baseUrl`), außer im Tools-Node: dort fest `https://uptimeify.io`.
- Commits: Conventional Commits, **niemals** ein `Co-Authored-By`-Trailer.
- Jeder Commit endet mit der Zeile `Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ`.

## Referenz: verifizierte API-Fakten

Gegengeprüft an `~/dev/website-monitoring/monitoring-app/server/api/` und der veröffentlichten
Doku. Wird in mehreren Tasks gebraucht.

**Monitor-Typen** (sieben), Pfad-Segment und Name des Config-Objekts im Body:

| `monitorType` | Pfad | Config-Schlüssel |
|---|---|---|
| `dns` | `/api/dns-monitors` | `dnsConfig` |
| `icmp` | `/api/icmp-monitors` | `icmpConfig` |
| `tcp` | `/api/tcp-monitors` | `config` |
| `smtp` | `/api/smtp-monitors` | `smtpConfig` |
| `ssh` | `/api/ssh-monitors` | `sshConfig` |
| `ftp` | `/api/ftp-monitors` | `ftpConfig` |
| `imap-pop` | `/api/imap-pop-monitors` | `imapPopConfig` |

Unterendpunkte je Monitor: `POST /:id/trigger-check`, `GET /:id/check-history`,
`GET /:id/alert-history`, `GET /:id/incident-history`.

**Pagination**, drei Formen:

1. Seiten — Antwort `{ items, total, page, perPage }`, Query `page` + `perPage` (max 200).
   Websites, Monitore, Maintenance Windows, Customer Domains, Customer IPs.
2. Cursor — Antwort `{ items, nextCursor }`, Query `limit` (max 100) + `cursor`.
   Nur `/api/im/incidents`.
3. Nacktes Array, keine Query-Pagination. `/api/customers`, `/api/tags`,
   `/api/notification-channels`, `/api/im/teams`, `/api/im/schedules`, `/api/im/on-call`.

**Fehler** tragen einen maschinenlesbaren Grund in `data.code`.

## File Structure

| Datei | Verantwortung |
|---|---|
| `credentials/UptimeifyApi.credentials.ts` | API-Token und Base URL, Auth-Header, Credential-Test |
| `nodes/Uptimeify/shared/errors.ts` | `data.code` → lesbare Meldung |
| `nodes/Uptimeify/shared/transport.ts` | Ein Request, plus die drei Pagination-Formen |
| `nodes/Uptimeify/shared/descriptions.ts` | Wiederverwendete Properties, Monitor-Tabellen |
| `nodes/Uptimeify/listSearch/*.ts` | Füllt die Auswahllisten der Resource Locators |
| `nodes/Uptimeify/resources/<name>/index.ts` | Property-Definitionen einer Ressource |
| `nodes/Uptimeify/resources/<name>/execute.ts` | Request-Aufbau je Operation dieser Ressource |
| `nodes/Uptimeify/Uptimeify.node.ts` | Node-Beschreibung und Router über die Ressourcen |
| `nodes/UptimeifyTrigger/shared/signature.ts` | HMAC-SHA256-Prüfung des rohen Bodys |
| `nodes/UptimeifyTrigger/UptimeifyTrigger.node.ts` | Webhook-Lifecycle und Event-Filter |
| `nodes/UptimeifyTools/shared/mcp.ts` | JSON-RPC-Aufruf gegen `/mcp` |
| `nodes/UptimeifyTools/UptimeifyTools.node.ts` | 20 Tool-Operationen |
| `test/*.test.ts` | Vitest-Tests für die reinen Funktionen |

Jede Ressource ist zweigeteilt: `index.ts` beschreibt die Oberfläche, `execute.ts` baut den
Request. Beide ändern sich zusammen und liegen deshalb nebeneinander. Der Node kennt nur diese
beiden Exporte je Ressource und bleibt dadurch klein.

---
### Task 1: Boilerplate entfernen, Paket-Metadaten, Test-Runner

**Files:**
- Delete: `nodes/GithubIssues/` (ganzes Verzeichnis), `credentials/GithubIssuesApi.credentials.ts`, `credentials/GithubIssuesOAuth2Api.credentials.ts`, `icons/github.svg`, `icons/github.dark.svg`
- Create: `icons/uptimeify.svg`, `icons/uptimeify.dark.svg`, `vitest.config.ts`, `test/smoke.test.ts`
- Modify: `package.json`, `tsconfig.json`

**Interfaces:**
- Consumes: nichts
- Produces: `npm test` läuft Vitest; `icons/uptimeify.svg` und `icons/uptimeify.dark.svg` existieren und werden von Credential und Nodes referenziert

- [ ] **Step 1: Boilerplate löschen**

```bash
rm -rf nodes/GithubIssues
rm credentials/GithubIssuesApi.credentials.ts credentials/GithubIssuesOAuth2Api.credentials.ts
rm icons/github.svg icons/github.dark.svg
```

- [ ] **Step 2: Icons übernehmen**

```bash
cp ~/dev/website-monitoring/monitoring-app/public/img/uptimeify-icon.svg icons/uptimeify.svg
cp ~/dev/website-monitoring/monitoring-app/public/img/uptimeify-icon-dark.svg icons/uptimeify.dark.svg
```

Beide Dateien öffnen und prüfen: kein `<script>`, keine externen `href`/`xlink:href`, ein
`viewBox` vorhanden. Fehlt `viewBox`, ergänzen — n8n skaliert das Icon sonst nicht.

- [ ] **Step 3: `package.json` schreiben**

```json
{
	"name": "@haupt-pascal/n8n-nodes-uptimeify",
	"version": "0.1.0",
	"description": "n8n nodes for Uptimeify: manage monitors, incidents and status pages, react to alerts, and run public network diagnostics",
	"license": "MIT",
	"homepage": "https://uptimeify.io",
	"keywords": [
		"n8n-community-node-package",
		"uptimeify",
		"monitoring",
		"uptime",
		"incident-management"
	],
	"author": {
		"name": "Pascal Haupt",
		"email": "pascal@haupt.design"
	},
	"repository": {
		"type": "git",
		"url": "https://github.com/haupt-pascal/n8n-nodes-uptimeify.git"
	},
	"scripts": {
		"build": "n8n-node build",
		"build:watch": "tsc --watch",
		"dev": "n8n-node dev",
		"lint": "n8n-node lint",
		"lint:fix": "n8n-node lint --fix",
		"test": "vitest run",
		"test:watch": "vitest",
		"release": "n8n-node release",
		"prepublishOnly": "n8n-node prerelease"
	},
	"files": [
		"dist"
	],
	"n8n": {
		"n8nNodesApiVersion": 1,
		"strict": true,
		"credentials": [
			"dist/credentials/UptimeifyApi.credentials.js"
		],
		"nodes": [
			"dist/nodes/Uptimeify/Uptimeify.node.js",
			"dist/nodes/UptimeifyTrigger/UptimeifyTrigger.node.js",
			"dist/nodes/UptimeifyTools/UptimeifyTools.node.js"
		]
	},
	"devDependencies": {
		"@n8n/node-cli": "*",
		"eslint": "9.32.0",
		"prettier": "3.6.2",
		"release-it": "^19.0.4",
		"typescript": "5.9.2",
		"vitest": "^3.2.4"
	},
	"peerDependencies": {
		"n8n-workflow": "*"
	}
}
```

- [ ] **Step 4: Tests aus dem Build ausschließen**

In `tsconfig.json` neben `"include"` ergänzen:

```json
	"include": ["credentials/**/*", "nodes/**/*", "nodes/**/*.json", "package.json"],
	"exclude": ["test/**/*", "**/*.test.ts", "dist/**/*"]
```

- [ ] **Step 5: Vitest konfigurieren**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
		environment: 'node',
	},
});
```

- [ ] **Step 6: Rauchtest schreiben**

`test/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

describe('package manifest', () => {
	it('has no runtime dependencies', () => {
		expect((packageJson as { dependencies?: Record<string, string> }).dependencies).toBeUndefined();
	});

	it('registers three nodes and one credential', () => {
		expect(packageJson.n8n.nodes).toHaveLength(3);
		expect(packageJson.n8n.credentials).toHaveLength(1);
	});
});
```

- [ ] **Step 7: Abhängigkeiten installieren, Test laufen lassen**

Run: `npm install && npm test`
Expected: 2 Tests PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: replace GitHub boilerplate with Uptimeify package metadata

Removes the scaffold node and credentials, adds the Uptimeify icons, points
package.json at the three planned nodes, and adds vitest for the pure helper
functions. Tests stay out of the TypeScript build output.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---

### Task 2: Credential `UptimeifyApi`

**Files:**
- Create: `credentials/UptimeifyApi.credentials.ts`

**Interfaces:**
- Consumes: `icons/uptimeify.svg`, `icons/uptimeify.dark.svg` aus Task 1
- Produces: Credential-Name `uptimeifyApi` mit den Feldern `apiToken: string` und `baseUrl: string`. Alle folgenden Tasks lesen die Base URL über `await this.getCredentials('uptimeifyApi')` und `credentials.baseUrl as string`.

- [ ] **Step 1: Credential schreiben**

`credentials/UptimeifyApi.credentials.ts`:

```ts
import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class UptimeifyApi implements ICredentialType {
	name = 'uptimeifyApi';

	displayName = 'Uptimeify API';

	icon: Icon = { light: 'file:../icons/uptimeify.svg', dark: 'file:../icons/uptimeify.dark.svg' };

	documentationUrl = 'https://uptimeify.io/docs/api/introduction/generate-api-token';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'wsm_...',
			description:
				'Create one under Settings, API tokens. Leave the customer field empty for an organization-wide token; Incident Management requires an organization-wide token',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://uptimeify.io',
			required: true,
			description: 'Change this only if you use Uptimeify under your own white-label domain',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/websites',
			method: 'GET',
			qs: { perPage: 1 },
		},
	};
}
```

- [ ] **Step 2: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe, Exit-Code 0.

- [ ] **Step 3: Commit**

```bash
git add credentials/UptimeifyApi.credentials.ts
git commit -m "feat: add Uptimeify API credential

Bearer token plus a configurable base URL for white-label deployments. The
credential test hits GET /api/websites?perPage=1.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---
### Task 3: Fehlerübersetzung

**Files:**
- Create: `nodes/Uptimeify/shared/errors.ts`
- Test: `test/errors.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `UPTIMEIFY_ERROR_MESSAGES: Record<string, string>`
  - `describeUptimeifyError(error: unknown): string | undefined`

- [ ] **Step 1: Failing test schreiben**

`test/errors.test.ts`:

```ts
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run test/errors.test.ts`
Expected: FAIL, `Failed to resolve import "../nodes/Uptimeify/shared/errors"`.

- [ ] **Step 3: Implementierung schreiben**

`nodes/Uptimeify/shared/errors.ts`:

```ts
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function readCode(value: unknown): string | undefined {
	if (!isRecord(value)) return undefined;

	const data = value.data;
	if (isRecord(data) && typeof data.code === 'string') return data.code;

	return undefined;
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
		const code = readCode(candidate);
		if (code !== undefined && code in UPTIMEIFY_ERROR_MESSAGES) {
			return UPTIMEIFY_ERROR_MESSAGES[code];
		}
	}

	return undefined;
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run test/errors.test.ts`
Expected: 4 Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add nodes/Uptimeify/shared/errors.ts test/errors.test.ts
git commit -m "feat: translate Uptimeify data.code values into readable messages

Covers monitor ownership, package, check mode, incident, and Incident
Management codes. Unknown codes fall through untouched.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---

### Task 4: HTTP-Transport und Pagination

**Files:**
- Create: `nodes/Uptimeify/shared/transport.ts`
- Test: `test/transport.test.ts`

**Interfaces:**
- Consumes: `describeUptimeifyError` (Task 3), Credential `uptimeifyApi` (Task 2)
- Produces:
  - `type UptimeifyContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions`
  - `uptimeifyApiRequest(this: UptimeifyContext, method: IHttpRequestMethods, path: string, body?: IDataObject, qs?: IDataObject): Promise<unknown>`
  - `uptimeifyApiRequestAllItems(this: UptimeifyContext, path: string, qs: IDataObject, options: { mode: 'page' | 'cursor' | 'array'; limit?: number }): Promise<IDataObject[]>`
  - `cleanQuery(qs: IDataObject): IDataObject`
  - `extractItems(response: unknown): IDataObject[]`
  - `MAX_PER_PAGE = 200`, `MAX_CURSOR_LIMIT = 100`

- [ ] **Step 1: Failing test schreiben**

`test/transport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cleanQuery, extractItems } from '../nodes/Uptimeify/shared/transport';

describe('cleanQuery', () => {
	it('drops undefined, null and empty strings but keeps false and zero', () => {
		expect(cleanQuery({ a: 1, b: undefined, c: null, d: '', e: 'x', f: false, g: 0 })).toEqual({
			a: 1,
			e: 'x',
			f: false,
			g: 0,
		});
	});

	it('keeps arrays so repeatable parameters survive', () => {
		expect(cleanQuery({ status: ['triggered', 'acknowledged'] })).toEqual({
			status: ['triggered', 'acknowledged'],
		});
	});
});

describe('extractItems', () => {
	it('unwraps a paged response', () => {
		expect(extractItems({ items: [{ id: 1 }], total: 1, page: 1, perPage: 50 })).toEqual([
			{ id: 1 },
		]);
	});

	it('passes a bare array through', () => {
		expect(extractItems([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
	});

	it('returns an empty array for anything else', () => {
		expect(extractItems(null)).toEqual([]);
		expect(extractItems({ statusPage: { id: 1 } })).toEqual([]);
	});
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run test/transport.test.ts`
Expected: FAIL, `Failed to resolve import "../nodes/Uptimeify/shared/transport"`.

- [ ] **Step 3: Implementierung schreiben**

`nodes/Uptimeify/shared/transport.ts`:

```ts
import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { describeUptimeifyError } from './errors';

export type UptimeifyContext =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IHookFunctions
	| IWebhookFunctions;

/** Page size ceiling of the paged endpoints. */
export const MAX_PER_PAGE = 200;

/** Page size ceiling of the cursor-paginated Incident Management endpoints. */
export const MAX_CURSOR_LIMIT = 100;

/**
 * Optional query parameters have to be absent, not empty. Uptimeify coerces `organizationId=`
 * to the number 0, which then fails its own minimum constraint with a 400.
 */
export function cleanQuery(qs: IDataObject): IDataObject {
	const cleaned: IDataObject = {};

	for (const [key, value] of Object.entries(qs)) {
		if (value === undefined || value === null || value === '') continue;
		cleaned[key] = value;
	}

	return cleaned;
}

export function extractItems(response: unknown): IDataObject[] {
	if (Array.isArray(response)) return response as IDataObject[];

	if (typeof response === 'object' && response !== null) {
		const items = (response as { items?: unknown }).items;
		if (Array.isArray(items)) return items as IDataObject[];
	}

	return [];
}

export async function uptimeifyApiRequest(
	this: UptimeifyContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs: IDataObject = {},
): Promise<unknown> {
	const credentials = await this.getCredentials('uptimeifyApi');
	const baseUrl = String(credentials.baseUrl ?? 'https://uptimeify.io').replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		qs: cleanQuery(qs),
		headers: { Accept: 'application/json' },
		json: true,
	};

	if (body !== undefined) options.body = body;

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'uptimeifyApi', options);
	} catch (error) {
		const description = describeUptimeifyError(error);
		throw new NodeApiError(
			this.getNode(),
			error as never,
			description === undefined ? undefined : { description },
		);
	}
}

/**
 * Walks a list endpoint to its end, or to `limit` items, whichever comes first. `mode` picks the
 * pagination dialect: `page` uses page/perPage, `cursor` uses limit/cursor, `array` means the
 * endpoint answers with everything at once.
 */
export async function uptimeifyApiRequestAllItems(
	this: UptimeifyContext,
	path: string,
	qs: IDataObject,
	options: { mode: 'page' | 'cursor' | 'array'; limit?: number },
): Promise<IDataObject[]> {
	const { mode, limit } = options;
	const collected: IDataObject[] = [];

	if (mode === 'array') {
		const response = await uptimeifyApiRequest.call(this, 'GET', path, undefined, qs);
		const items = extractItems(response);
		return limit === undefined ? items : items.slice(0, limit);
	}

	if (mode === 'cursor') {
		let cursor: string | undefined;

		do {
			const pageSize =
				limit === undefined
					? MAX_CURSOR_LIMIT
					: Math.min(MAX_CURSOR_LIMIT, limit - collected.length);
			const response = await uptimeifyApiRequest.call(this, 'GET', path, undefined, {
				...qs,
				limit: pageSize,
				cursor,
			});
			const items = extractItems(response);
			collected.push(...items);

			cursor = (response as { nextCursor?: string | null }).nextCursor ?? undefined;
			if (items.length === 0) break;
		} while (cursor !== undefined && (limit === undefined || collected.length < limit));

		return limit === undefined ? collected : collected.slice(0, limit);
	}

	let page = 1;

	for (;;) {
		const response = await uptimeifyApiRequest.call(this, 'GET', path, undefined, {
			...qs,
			page,
			perPage: MAX_PER_PAGE,
		});
		const items = extractItems(response);
		collected.push(...items);

		if (items.length < MAX_PER_PAGE) break;
		if (limit !== undefined && collected.length >= limit) break;
		page += 1;
	}

	return limit === undefined ? collected : collected.slice(0, limit);
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run test/transport.test.ts`
Expected: 5 Tests PASS.

- [ ] **Step 5: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe, Exit-Code 0.

- [ ] **Step 6: Commit**

```bash
git add nodes/Uptimeify/shared/transport.ts test/transport.test.ts
git commit -m "feat: add Uptimeify HTTP transport with three pagination modes

Page, cursor and bare-array endpoints all answer differently, so the caller
picks the dialect. Empty query parameters are stripped because the API coerces
them to zero and then rejects the request.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---
