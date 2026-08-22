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
| `nodes/Uptimeify/shared/types.ts` | Der Vertrag `ResourceExecute`, dem jede Ressource folgt |
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

	it('unwraps a data array, the shape the history endpoints answer with', () => {
		expect(extractItems({ data: [{ id: 'chk_1' }] })).toEqual([{ id: 'chk_1' }]);
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

/**
 * List endpoints answer in three shapes: a bare array, `{ items }` for the paged and cursor
 * endpoints, and `{ data }` for the check/alert/incident history endpoints.
 */
export function extractItems(response: unknown): IDataObject[] {
	if (Array.isArray(response)) return response as IDataObject[];

	if (typeof response === 'object' && response !== null) {
		const items = (response as { items?: unknown }).items;
		if (Array.isArray(items)) return items as IDataObject[];

		const data = (response as { data?: unknown }).data;
		if (Array.isArray(data)) return data as IDataObject[];
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
Expected: 6 Tests PASS.

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
### Task 5: Geteilte Properties und Auswahllisten

**Files:**
- Create: `nodes/Uptimeify/shared/descriptions.ts`
- Create: `nodes/Uptimeify/listSearch/getCustomers.ts`, `getWebsites.ts`, `getMonitors.ts`, `getTags.ts`, `getTeams.ts`

**Interfaces:**
- Consumes: `uptimeifyApiRequest`, `extractItems` (Task 4)
- Produces:
  - `customerLocator`, `websiteLocator`, `monitorLocator`, `tagLocator`, `teamLocator`: `INodeProperties`
  - `returnAllProperties(resource: string, operation: string): INodeProperties[]`
  - `MONITOR_TYPE_OPTIONS: Array<{ name: string; value: string }>`
  - `MONITOR_PATHS: Record<string, string>`, `MONITOR_CONFIG_KEYS: Record<string, string>`
  - `getCustomers`, `getWebsites`, `getMonitors`, `getTags`, `getTeams`: `(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string) => Promise<INodeListSearchResult>`

Kunden-, Website- und Monitor-Locator liefern die **Public ID** (UUID) als Wert; die Routen
lösen über `resolveNumericIdByIdentifier` auf und nehmen beides. Tag- und Team-Locator liefern
die **numerische ID**, weil `/api/monitor-tags` und `/api/im/*` nur Zahlen annehmen.

- [ ] **Step 1: Geteilte Properties schreiben**

`nodes/Uptimeify/shared/descriptions.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';

export const MONITOR_TYPE_OPTIONS = [
	{ name: 'DNS', value: 'dns' },
	{ name: 'FTP', value: 'ftp' },
	{ name: 'ICMP (Ping)', value: 'icmp' },
	{ name: 'IMAP/POP', value: 'imap-pop' },
	{ name: 'SMTP', value: 'smtp' },
	{ name: 'SSH', value: 'ssh' },
	{ name: 'TCP Port', value: 'tcp' },
];

export const MONITOR_PATHS: Record<string, string> = {
	dns: '/api/dns-monitors',
	ftp: '/api/ftp-monitors',
	icmp: '/api/icmp-monitors',
	'imap-pop': '/api/imap-pop-monitors',
	smtp: '/api/smtp-monitors',
	ssh: '/api/ssh-monitors',
	tcp: '/api/tcp-monitors',
};

export const MONITOR_CONFIG_KEYS: Record<string, string> = {
	dns: 'dnsConfig',
	ftp: 'ftpConfig',
	icmp: 'icmpConfig',
	'imap-pop': 'imapPopConfig',
	smtp: 'smtpConfig',
	ssh: 'sshConfig',
	tcp: 'config',
};

function locator(
	displayName: string,
	name: string,
	searchListMethod: string,
	idPlaceholder: string,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select from the list...',
				typeOptions: {
					searchListMethod,
					searchable: true,
					searchFilterRequired: false,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: idPlaceholder,
			},
		],
	};
}

export const customerLocator = locator(
	'Customer',
	'customerId',
	'getCustomers',
	'e.g. 059e1469-0f05-4c93-bd4d-89c45bb2afd9',
);

export const websiteLocator = locator(
	'Website',
	'websiteId',
	'getWebsites',
	'e.g. 11111111-1111-4111-8111-111111111111',
);

export const monitorLocator = locator(
	'Monitor',
	'monitorId',
	'getMonitors',
	'e.g. 3d005a18-fdd8-4dc7-9f26-1a9d409c1bc5',
);

export const tagLocator = locator('Tag', 'tagId', 'getTags', 'e.g. 7');

export const teamLocator = locator('Team', 'teamId', 'getTeams', 'e.g. 3');

/** The Return All / Limit pair, wired to one resource and operation. */
export function returnAllProperties(resource: string, operation: string): INodeProperties[] {
	const show = { resource: [resource], operation: [operation] };

	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			default: 50,
			typeOptions: { minValue: 1 },
			description: 'Max number of results to return',
			displayOptions: { show: { ...show, returnAll: [false] } },
		},
	];
}
```

- [ ] **Step 2: `getCustomers` schreiben**

`nodes/Uptimeify/listSearch/getCustomers.ts`:

```ts
import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { extractItems, uptimeifyApiRequest } from '../shared/transport';

type CustomerRow = { id: number; publicId: string; name: string };

export async function getCustomers(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await uptimeifyApiRequest.call(this, 'GET', '/api/customers', undefined, {
		fields: 'minimal',
	});

	const rows = extractItems(response) as unknown as CustomerRow[];
	const needle = filter?.toLowerCase();

	return {
		results: rows
			.filter((row) => needle === undefined || row.name.toLowerCase().includes(needle))
			.map((row) => ({ name: row.name, value: row.publicId })),
	};
}
```

- [ ] **Step 3: `getWebsites` schreiben**

`nodes/Uptimeify/listSearch/getWebsites.ts`:

```ts
import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { extractItems, uptimeifyApiRequest } from '../shared/transport';

type WebsiteRow = { publicId: string; name: string; url: string };

export async function getWebsites(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const page = paginationToken === undefined ? 1 : Number(paginationToken);
	const perPage = 100;

	const response = await uptimeifyApiRequest.call(this, 'GET', '/api/websites', undefined, {
		search: filter,
		page,
		perPage,
	});

	const rows = extractItems(response) as unknown as WebsiteRow[];
	const total = (response as { total?: number }).total ?? rows.length;

	return {
		results: rows.map((row) => ({ name: `${row.name} (${row.url})`, value: row.publicId })),
		paginationToken: page * perPage < total ? String(page + 1) : undefined,
	};
}
```

- [ ] **Step 4: `getMonitors` schreiben**

`nodes/Uptimeify/listSearch/getMonitors.ts`:

```ts
import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { MONITOR_PATHS } from '../shared/descriptions';
import { extractItems, uptimeifyApiRequest } from '../shared/transport';

type MonitorRow = { publicId: string; name: string; hostname?: string };

export async function getMonitors(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const monitorType = this.getNodeParameter('monitorType', 'dns') as string;
	const path = MONITOR_PATHS[monitorType] ?? MONITOR_PATHS.dns;
	const page = paginationToken === undefined ? 1 : Number(paginationToken);
	const perPage = 100;

	const response = await uptimeifyApiRequest.call(this, 'GET', path, undefined, {
		search: filter,
		page,
		perPage,
	});

	const rows = extractItems(response) as unknown as MonitorRow[];
	const total = (response as { total?: number }).total ?? rows.length;

	return {
		results: rows.map((row) => ({
			name: row.hostname === undefined ? row.name : `${row.name} (${row.hostname})`,
			value: row.publicId,
		})),
		paginationToken: page * perPage < total ? String(page + 1) : undefined,
	};
}
```

- [ ] **Step 5: `getTags` und `getTeams` schreiben**

`nodes/Uptimeify/listSearch/getTags.ts`:

```ts
import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { extractItems, uptimeifyApiRequest } from '../shared/transport';

type TagRow = { id: number; name: string; color: string };

export async function getTags(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await uptimeifyApiRequest.call(this, 'GET', '/api/tags');
	const rows = extractItems(response) as unknown as TagRow[];
	const needle = filter?.toLowerCase();

	return {
		results: rows
			.filter((row) => needle === undefined || row.name.toLowerCase().includes(needle))
			.map((row) => ({ name: row.name, value: row.id })),
	};
}
```

`nodes/Uptimeify/listSearch/getTeams.ts`:

```ts
import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { extractItems, uptimeifyApiRequest } from '../shared/transport';

type TeamRow = { id: number; name: string };

export async function getTeams(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await uptimeifyApiRequest.call(this, 'GET', '/api/im/teams');
	const rows = extractItems(response) as unknown as TeamRow[];
	const needle = filter?.toLowerCase();

	return {
		results: rows
			.filter((row) => needle === undefined || row.name.toLowerCase().includes(needle))
			.map((row) => ({ name: row.name, value: row.id })),
	};
}
```

- [ ] **Step 6: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe, Exit-Code 0.

- [ ] **Step 7: Commit**

```bash
git add nodes/Uptimeify/shared/descriptions.ts nodes/Uptimeify/listSearch
git commit -m "feat: add shared resource locators and list search methods

Customer, website and monitor locators carry the public UUID because the routes
resolve either identifier. Tag and team locators carry the numeric id because
monitor-tags and the Incident Management routes take nothing else.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---
### Task 6: Node-Gerüst und Ressource *Website*

Diese Aufgabe legt den Vertrag fest, dem jede weitere Ressource folgt. Wer sie liest, bevor er
Task 7 bis 16 baut, spart sich Rückfragen.

**Files:**
- Create: `nodes/Uptimeify/shared/types.ts`
- Create: `nodes/Uptimeify/resources/website/index.ts`, `nodes/Uptimeify/resources/website/execute.ts`
- Create: `nodes/Uptimeify/Uptimeify.node.ts`, `nodes/Uptimeify/Uptimeify.node.json`

**Interfaces:**
- Consumes: alles aus Task 4 und 5
- Produces:
  - `nodes/Uptimeify/shared/types.ts` exportiert `type ResourceExecute = (this: IExecuteFunctions, operation: string, itemIndex: number) => Promise<IDataObject | IDataObject[]>`
  - je Ressource ein Modul mit `export const <name>Description: INodeProperties[]` und `export const execute<Name>: ResourceExecute`
  - Der Node ruft `execute<Name>` auf und verpackt das Ergebnis selbst in `INodeExecutionData`. Eine Ressource gibt **rohe Objekte** zurück, nie `INodeExecutionData`.

- [ ] **Step 1: Ressourcen-Vertrag schreiben**

`nodes/Uptimeify/shared/types.ts`:

```ts
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
```

- [ ] **Step 2: Properties der Ressource Website schreiben**

`nodes/Uptimeify/resources/website/index.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties, websiteLocator } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['website'], operation: [operation] });

export const websiteDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['website'] } },
		options: [
			{ name: 'Change Status', value: 'changeStatus', action: 'Change a website status' },
			{ name: 'Create', value: 'create', action: 'Create a website' },
			{ name: 'Delete', value: 'delete', action: 'Delete a website' },
			{ name: 'Get', value: 'get', action: 'Get a website' },
			{ name: 'Get Check History', value: 'getCheckHistory', action: 'Get website check history' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many websites' },
			{ name: 'Get Uptime Stats', value: 'getUptimeStats', action: 'Get website uptime stats' },
			{ name: 'Trigger Check', value: 'triggerCheck', action: 'Trigger a website check' },
			{ name: 'Update', value: 'update', action: 'Update a website' },
		],
		default: 'getAll',
	},

	{ ...customerLocator, displayOptions: { show: show('create') } },
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'Display name of the website, 1 to 255 characters',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://shop.example.com',
		description: 'URL to monitor. Leave empty only for heartbeat monitors.',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('create') },
		options: [
			{
				displayName: 'Allowed Check Country Codes',
				name: 'allowedCheckCountryCodes',
				type: 'string',
				default: '',
				placeholder: 'e.g. DE,FI,PL',
				description:
					'Comma-separated two-letter country codes the checks are restricted to. Empty means the organization default.',
			},
			{
				displayName: 'Auth Mode',
				name: 'authMode',
				type: 'options',
				options: [
					{ name: 'None', value: 'none' },
					{ name: 'Authorization Header', value: 'authorization_header' },
					{ name: 'Basic', value: 'basic' },
				],
				default: 'none',
			},
			{
				displayName: 'Authorization Header',
				name: 'authorizationHeader',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'Required when auth mode is Authorization Header',
			},
			{
				displayName: 'Basic Auth Password',
				name: 'basicAuthPassword',
				type: 'string',
				typeOptions: { password: true },
				default: '',
			},
			{ displayName: 'Basic Auth Username', name: 'basicAuthUsername', type: 'string', default: '' },
			{
				displayName: 'Check Interval (Minutes)',
				name: 'checkInterval',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 60 },
				default: 30,
			},
			{
				displayName: 'Expected Status Codes',
				name: 'expectedStatusCodes',
				type: 'string',
				default: '200,301,302',
				description: 'Comma-separated list of HTTP status codes treated as up',
			},
			{ displayName: 'Follow Redirects', name: 'followRedirects', type: 'boolean', default: true },
			{
				displayName: 'HTTP Method',
				name: 'httpMethod',
				type: 'options',
				options: [
					{ name: 'DELETE', value: 'DELETE' },
					{ name: 'GET', value: 'GET' },
					{ name: 'HEAD', value: 'HEAD' },
					{ name: 'OPTIONS', value: 'OPTIONS' },
					{ name: 'PATCH', value: 'PATCH' },
					{ name: 'POST', value: 'POST' },
					{ name: 'PUT', value: 'PUT' },
					{ name: 'QUERY', value: 'QUERY' },
				],
				default: 'GET',
			},
			{
				displayName: 'Management Type',
				name: 'managementType',
				type: 'options',
				options: [
					{ name: 'Managed', value: 'managed' },
					{ name: 'Self Service', value: 'self_service' },
				],
				default: 'managed',
				description: 'Only organization admins may choose this',
			},
			{
				displayName: 'Monitoring Type',
				name: 'monitoringType',
				type: 'options',
				options: [
					{ name: 'Combined', value: 'combined' },
					{ name: 'DNS', value: 'dns' },
					{ name: 'Heartbeat', value: 'heartbeat' },
					{ name: 'HTTP Status', value: 'http_status' },
					{ name: 'Playwright', value: 'playwright' },
					{ name: 'SSL Check', value: 'ssl_check' },
				],
				default: 'combined',
			},
			{
				displayName: 'Search Term',
				name: 'searchTerm',
				type: 'string',
				default: '',
				description: 'Keyword that has to appear in the response body',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Maintenance', value: 'maintenance' },
				],
				default: 'active',
			},
			{
				displayName: 'Timeout (Seconds)',
				name: 'timeoutSeconds',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 60 },
				default: 30,
			},
		],
	},

	{
		...websiteLocator,
		displayOptions: {
			show: {
				resource: ['website'],
				operation: [
					'changeStatus',
					'delete',
					'get',
					'getCheckHistory',
					'getUptimeStats',
					'triggerCheck',
					'update',
				],
			},
		},
	},

	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: [
			{ name: 'Active', value: 'active' },
			{ name: 'Inactive', value: 'inactive' },
			{ name: 'Maintenance', value: 'maintenance' },
		],
		default: 'active',
		required: true,
		displayOptions: { show: show('changeStatus') },
	},

	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('update') },
		options: [
			{
				displayName: 'Check Interval (Minutes)',
				name: 'checkInterval',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 60 },
				default: 30,
			},
			{ displayName: 'Expected Status Codes', name: 'expectedStatusCodes', type: 'string', default: '' },
			{ displayName: 'Follow Redirects', name: 'followRedirects', type: 'boolean', default: true },
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Search Term', name: 'searchTerm', type: 'string', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Maintenance', value: 'maintenance' },
				],
				default: 'active',
			},
			{
				displayName: 'Timeout (Seconds)',
				name: 'timeoutSeconds',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 60 },
				default: 30,
			},
			{ displayName: 'URL', name: 'url', type: 'string', default: '' },
		],
	},

	...returnAllProperties('website', 'getAll'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: show('getAll') },
		options: [
			{ ...customerLocator, required: false },
			{
				displayName: 'Monitoring Type',
				name: 'monitoringType',
				type: 'options',
				options: [
					{ name: 'Combined', value: 'combined' },
					{ name: 'DNS', value: 'dns' },
					{ name: 'Heartbeat', value: 'heartbeat' },
					{ name: 'HTTP Status', value: 'http_status' },
					{ name: 'Playwright', value: 'playwright' },
					{ name: 'SSL Check', value: 'ssl_check' },
				],
				default: 'combined',
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Matches website and customer fields',
			},
		],
	},

	...returnAllProperties('website', 'getCheckHistory'),
	{
		displayName: 'Check Type',
		name: 'checkType',
		type: 'options',
		options: [
			{ name: 'Any', value: '' },
			{ name: 'Combined', value: 'combined' },
			{ name: 'DNS', value: 'dns' },
			{ name: 'Heartbeat', value: 'heartbeat' },
			{ name: 'HTTP Status', value: 'http_status' },
			{ name: 'Playwright', value: 'playwright' },
			{ name: 'SSL Check', value: 'ssl_check' },
		],
		default: '',
		displayOptions: { show: show('getCheckHistory') },
	},
];
```

- [ ] **Step 3: `execute` der Ressource Website schreiben**

`nodes/Uptimeify/resources/website/execute.ts`:

```ts
import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeWebsite: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const body: IDataObject = {
			customerId: this.getNodeParameter('customerId', itemIndex, undefined, {
				extractValue: true,
			}) as string,
			name: this.getNodeParameter('name', itemIndex) as string,
			url: this.getNodeParameter('url', itemIndex) as string,
			...(this.getNodeParameter('additionalFields', itemIndex) as IDataObject),
		};

		if (typeof body.allowedCheckCountryCodes === 'string') {
			const codes = body.allowedCheckCountryCodes
				.split(',')
				.map((code) => code.trim())
				.filter((code) => code !== '');
			body.allowedCheckCountryCodes = codes.length === 0 ? null : codes;
		}

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/websites', body)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const filters = this.getNodeParameter('filters', itemIndex) as IDataObject;
		const qs: IDataObject = { ...filters };

		if (typeof qs.customerId === 'object' && qs.customerId !== null) {
			qs.customerId = (qs.customerId as { value?: string }).value;
		}

		return await uptimeifyApiRequestAllItems.call(this, '/api/websites', qs, {
			mode: 'page',
			limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
		});
	}

	const websiteId = this.getNodeParameter('websiteId', itemIndex, undefined, {
		extractValue: true,
	}) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/websites/${websiteId}`,
		)) as IDataObject;
	}

	if (operation === 'update') {
		const body = this.getNodeParameter('updateFields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/websites/${websiteId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'changeStatus') {
		const body: IDataObject = { status: this.getNodeParameter('status', itemIndex) as string };

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/websites/${websiteId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/websites/${websiteId}`);
		return { success: true, websiteId };
	}

	if (operation === 'triggerCheck') {
		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/websites/${websiteId}/trigger-check`,
			{},
		)) as IDataObject;
	}

	if (operation === 'getCheckHistory') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const checkType = this.getNodeParameter('checkType', itemIndex) as string;
		const limit = returnAll ? 200 : (this.getNodeParameter('limit', itemIndex) as number);

		const response = await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/websites/${websiteId}/check-history`,
			undefined,
			{ limit: Math.min(limit, 200), checkType },
		);

		const rows = (response as { data?: IDataObject[] }).data ?? [];
		return returnAll ? rows : rows.slice(0, limit);
	}

	if (operation === 'getUptimeStats') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/websites/${websiteId}/uptime-stats`,
		)) as IDataObject;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for websites`,
		{ itemIndex },
	);
};
```

**Hinweis zu `getCheckHistory`:** Dieser Endpunkt kennt keine Seiten, nur `limit` mit Maximum
200. *Return All* liefert deshalb höchstens 200 Einträge — das steht so in der Beschreibung des
Feldes und ist keine stille Kürzung.

- [ ] **Step 4: Node-Klasse schreiben**

`nodes/Uptimeify/Uptimeify.node.ts`:

```ts
import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { getCustomers } from './listSearch/getCustomers';
import { getMonitors } from './listSearch/getMonitors';
import { getTags } from './listSearch/getTags';
import { getTeams } from './listSearch/getTeams';
import { getWebsites } from './listSearch/getWebsites';
import { websiteDescription } from './resources/website';
import { executeWebsite } from './resources/website/execute';
import type { ResourceExecute } from './shared/types';

const RESOURCE_EXECUTORS: Record<string, ResourceExecute> = {
	website: executeWebsite,
};

export class Uptimeify implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Uptimeify',
		name: 'uptimeify',
		icon: { light: 'file:../../icons/uptimeify.svg', dark: 'file:../../icons/uptimeify.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage monitors, incidents and status pages in Uptimeify',
		defaults: { name: 'Uptimeify' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'uptimeifyApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Website', value: 'website' }],
				default: 'website',
			},
			...websiteDescription,
		],
	};

	methods = {
		listSearch: {
			getCustomers,
			getMonitors,
			getTags,
			getTeams,
			getWebsites,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const executor = RESOURCE_EXECUTORS[resource];

				if (executor === undefined) {
					throw new NodeOperationError(this.getNode(), `Unknown resource "${resource}"`, {
						itemIndex: i,
					});
				}

				const result = await executor.call(this, operation, i);
				const rows: IDataObject[] = Array.isArray(result) ? result : [result];

				returnData.push(
					...rows.map((row) => ({ json: row, pairedItem: { item: i } })),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				throw error;
			}
		}

		return [returnData];
	}
}
```

- [ ] **Step 5: Node-Metadaten schreiben**

`nodes/Uptimeify/Uptimeify.node.json`:

```json
{
	"node": "n8n-nodes-base.uptimeify",
	"nodeVersion": "1.0",
	"codexVersion": "1.0",
	"categories": ["Development", "Developer Tools"],
	"resources": {
		"credentialDocumentation": [
			{
				"url": "https://github.com/haupt-pascal/n8n-nodes-uptimeify?tab=readme-ov-file#credentials"
			}
		],
		"primaryDocumentation": [
			{
				"url": "https://uptimeify.io/docs/api"
			}
		]
	}
}
```

- [ ] **Step 6: Bauen und linten**

Run: `npm run build && npm run lint`
Expected: Build erfolgreich, Lint ohne Fehler und ohne Warnungen.

- [ ] **Step 7: Commit**

```bash
git add nodes/Uptimeify
git commit -m "feat: add Uptimeify node with the website resource

Establishes the resource contract every later resource follows: index.ts holds
the properties, execute.ts builds the request, the node itself only routes and
wraps results into items.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---
### Task 7: Ressource *Monitor*

**Files:**
- Create: `nodes/Uptimeify/resources/monitor/index.ts`, `nodes/Uptimeify/resources/monitor/execute.ts`
- Modify: `nodes/Uptimeify/Uptimeify.node.ts`

**Interfaces:**
- Consumes: `ResourceExecute` (Task 6), `MONITOR_TYPE_OPTIONS`, `MONITOR_PATHS`, `MONITOR_CONFIG_KEYS`, `customerLocator`, `monitorLocator`, `returnAllProperties` (Task 5), Transport (Task 4)
- Produces: `monitorDescription: INodeProperties[]`, `executeMonitor: ResourceExecute`

Der Parameter `monitorType` steht **vor** allen anderen Feldern der Ressource, weil
`getMonitors` ihn liest, um die richtige Liste zu laden.

- [ ] **Step 1: Properties schreiben**

`nodes/Uptimeify/resources/monitor/index.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';
import {
	customerLocator,
	monitorLocator,
	MONITOR_TYPE_OPTIONS,
	returnAllProperties,
} from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['monitor'], operation: [operation] });
const showType = (monitorType: string, operations: string[]) => ({
	resource: ['monitor'],
	operation: operations,
	monitorType: [monitorType],
});

const WRITE_OPERATIONS = ['create', 'update'];

export const monitorDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['monitor'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a monitor' },
			{ name: 'Delete', value: 'delete', action: 'Delete a monitor' },
			{ name: 'Get', value: 'get', action: 'Get a monitor' },
			{ name: 'Get Alert History', value: 'getAlertHistory', action: 'Get monitor alert history' },
			{ name: 'Get Check History', value: 'getCheckHistory', action: 'Get monitor check history' },
			{
				name: 'Get Incident History',
				value: 'getIncidentHistory',
				action: 'Get monitor incident history',
			},
			{ name: 'Get Many', value: 'getAll', action: 'Get many monitors' },
			{ name: 'Trigger Check', value: 'triggerCheck', action: 'Trigger a monitor check' },
			{ name: 'Update', value: 'update', action: 'Update a monitor' },
		],
		default: 'getAll',
	},
	{
		displayName: 'Monitor Type',
		name: 'monitorType',
		type: 'options',
		noDataExpression: true,
		options: MONITOR_TYPE_OPTIONS,
		default: 'icmp',
		required: true,
		description: 'Which kind of monitor to work with. It decides the endpoint that is called.',
		displayOptions: { show: { resource: ['monitor'] } },
	},

	{ ...customerLocator, displayOptions: { show: show('create') } },
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Hostname',
		name: 'hostname',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. mail.example.com',
		description: 'Hostname or IP only, without a protocol and without a path',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Port',
		name: 'port',
		type: 'number',
		default: 6379,
		required: true,
		typeOptions: { minValue: 1, maxValue: 65535 },
		description: 'TCP monitors have no default port, so it has to be set',
		displayOptions: { show: showType('tcp', ['create']) },
	},

	{
		...monitorLocator,
		displayOptions: {
			show: {
				resource: ['monitor'],
				operation: [
					'delete',
					'get',
					'getAlertHistory',
					'getCheckHistory',
					'getIncidentHistory',
					'triggerCheck',
					'update',
				],
			},
		},
	},

	{
		displayName: 'Common Fields',
		name: 'commonFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['monitor'], operation: WRITE_OPERATIONS } },
		options: [
			{
				displayName: 'Check Interval (Minutes)',
				name: 'checkInterval',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 1440 },
				default: 30,
			},
			{ displayName: 'Hostname', name: 'hostname', type: 'string', default: '' },
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{
				displayName: 'Port',
				name: 'port',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 65535 },
				default: 0,
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Disabled', value: 'disabled' },
					{ name: 'Maintenance', value: 'maintenance' },
				],
				default: 'active',
			},
			{
				displayName: 'Timeout (Seconds)',
				name: 'timeoutSeconds',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 60 },
				default: 30,
			},
		],
	},
	{
		displayName: 'Check Mode',
		name: 'checkMode',
		type: 'options',
		options: [
			{ name: 'Protocol', value: 'protocol' },
			{ name: 'TCP', value: 'tcp' },
		],
		default: 'protocol',
		description:
			'TCP mode only checks that the port answers, so no credentials are needed or stored. IMAP/POP additionally needs an explicit port in TCP mode.',
		displayOptions: {
			show: {
				resource: ['monitor'],
				operation: WRITE_OPERATIONS,
				monitorType: ['smtp', 'ssh', 'ftp', 'imap-pop'],
			},
		},
	},

	{
		displayName: 'RR Types',
		name: 'rrtypes',
		type: 'multiOptions',
		options: [
			{ name: 'A', value: 'A' },
			{ name: 'AAAA', value: 'AAAA' },
			{ name: 'CNAME', value: 'CNAME' },
			{ name: 'MX', value: 'MX' },
			{ name: 'NS', value: 'NS' },
			{ name: 'SOA', value: 'SOA' },
			{ name: 'TXT', value: 'TXT' },
		],
		default: ['A'],
		required: true,
		displayOptions: { show: showType('dns', WRITE_OPERATIONS) },
	},
	{
		displayName: 'Match Mode',
		name: 'matchMode',
		type: 'options',
		options: [
			{ name: 'Contains', value: 'contains' },
			{ name: 'Exact', value: 'exact' },
		],
		default: 'exact',
		required: true,
		displayOptions: { show: showType('dns', WRITE_OPERATIONS) },
	},
	{
		displayName: 'Expected Values',
		name: 'expectedValues',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Expected Value',
		default: {},
		required: true,
		description: 'Every RR type listed above needs at least one expected value',
		displayOptions: { show: showType('dns', WRITE_OPERATIONS) },
		options: [
			{
				displayName: 'Value',
				name: 'value',
				values: [
					{
						displayName: 'RR Type',
						name: 'rrtype',
						type: 'string',
						default: 'A',
						placeholder: 'e.g. A',
					},
					{
						displayName: 'Values',
						name: 'values',
						type: 'string',
						default: '',
						placeholder: 'e.g. 93.184.216.34, 93.184.216.35',
						description: 'Comma-separated list of expected records',
					},
				],
			},
		],
	},
	{
		displayName: 'DNS Options',
		name: 'dnsOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showType('dns', WRITE_OPERATIONS) },
		options: [
			{
				displayName: 'Trigger on Mismatch',
				name: 'mismatch',
				type: 'boolean',
				default: true,
				description: 'Whether an answer that differs from the expected values raises an incident',
			},
			{
				displayName: 'Trigger on Resolve Error',
				name: 'resolveError',
				type: 'boolean',
				default: true,
				description: 'Whether a failed resolution raises an incident',
			},
		],
	},

	{
		displayName: 'ICMP Options',
		name: 'icmpOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showType('icmp', WRITE_OPERATIONS) },
		options: [
			{ displayName: 'Count', name: 'count', type: 'number', default: 4 },
			{ displayName: 'Packet Size', name: 'packetSize', type: 'number', default: 56 },
		],
	},
	{
		displayName: 'TCP Options',
		name: 'tcpOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showType('tcp', WRITE_OPERATIONS) },
		options: [
			{
				displayName: 'Expect Banner',
				name: 'expectBanner',
				type: 'string',
				default: '',
				description: 'String the service has to answer with',
			},
		],
	},
	{
		displayName: 'SMTP Options',
		name: 'smtpOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showType('smtp', WRITE_OPERATIONS) },
		options: [
			{ displayName: 'Ignore TLS', name: 'ignoreTls', type: 'boolean', default: false },
			{
				displayName: 'Password',
				name: 'pass',
				type: 'string',
				typeOptions: { password: true },
				default: '',
			},
			{ displayName: 'Require TLS', name: 'requireTls', type: 'boolean', default: false },
			{
				displayName: 'Secure',
				name: 'secure',
				type: 'boolean',
				default: false,
				description: 'Whether to connect over implicit TLS, which defaults the port to 465',
			},
			{ displayName: 'Username', name: 'user', type: 'string', default: '' },
		],
	},
	{
		displayName: 'SSH Options',
		name: 'sshOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showType('ssh', WRITE_OPERATIONS) },
		options: [
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
			},
			{
				displayName: 'Private Key',
				name: 'privateKey',
				type: 'string',
				typeOptions: { password: true, rows: 4 },
				default: '',
			},
			{ displayName: 'Username', name: 'username', type: 'string', default: '' },
		],
	},
	{
		displayName: 'FTP Options',
		name: 'ftpOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showType('ftp', WRITE_OPERATIONS) },
		options: [
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
			},
			{
				displayName: 'Secure',
				name: 'secure',
				type: 'options',
				options: [
					{ name: 'Explicit TLS', value: 'true' },
					{ name: 'Implicit TLS', value: 'implicit' },
					{ name: 'Plain FTP', value: 'false' },
				],
				default: 'false',
			},
			{ displayName: 'Username', name: 'user', type: 'string', default: '' },
		],
	},
	{
		displayName: 'IMAP/POP Options',
		name: 'imapPopOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showType('imap-pop', WRITE_OPERATIONS) },
		options: [
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
			},
			{
				displayName: 'Protocol',
				name: 'protocol',
				type: 'options',
				options: [
					{ name: 'IMAP', value: 'imap' },
					{ name: 'POP3', value: 'pop3' },
				],
				default: 'imap',
			},
			{ displayName: 'TLS', name: 'tls', type: 'boolean', default: true },
			{ displayName: 'Username', name: 'user', type: 'string', default: '' },
		],
	},

	...returnAllProperties('monitor', 'getAll'),
	...returnAllProperties('monitor', 'getCheckHistory'),
	...returnAllProperties('monitor', 'getAlertHistory'),
	...returnAllProperties('monitor', 'getIncidentHistory'),
];
```

- [ ] **Step 2: `execute` schreiben**

`nodes/Uptimeify/resources/monitor/execute.ts`:

```ts
import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { MONITOR_CONFIG_KEYS, MONITOR_PATHS } from '../../shared/descriptions';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

type ExpectedValueEntry = { rrtype: string; values: string };

function splitList(raw: string): string[] {
	return raw
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '');
}

/** Builds the type-specific config object under its own key, e.g. `dnsConfig` for DNS. */
function buildConfig(
	context: IExecuteFunctions,
	monitorType: string,
	itemIndex: number,
): IDataObject | undefined {
	if (monitorType === 'dns') {
		const entries = (
			(context.getNodeParameter('expectedValues', itemIndex) as IDataObject).value ?? []
		) as unknown as ExpectedValueEntry[];

		const expectedValues: IDataObject = {};
		for (const entry of entries) {
			expectedValues[entry.rrtype] = splitList(entry.values);
		}

		const options = context.getNodeParameter('dnsOptions', itemIndex) as IDataObject;

		return {
			rrtypes: context.getNodeParameter('rrtypes', itemIndex) as string[],
			matchMode: context.getNodeParameter('matchMode', itemIndex) as string,
			expectedValues,
			triggerOn: {
				resolveError: options.resolveError ?? true,
				mismatch: options.mismatch ?? true,
			},
		};
	}

	const optionParameter: Record<string, string> = {
		icmp: 'icmpOptions',
		tcp: 'tcpOptions',
		smtp: 'smtpOptions',
		ssh: 'sshOptions',
		ftp: 'ftpOptions',
		'imap-pop': 'imapPopOptions',
	};

	const parameterName = optionParameter[monitorType];
	if (parameterName === undefined) return undefined;

	const options = context.getNodeParameter(parameterName, itemIndex) as IDataObject;
	if (Object.keys(options).length === 0) return undefined;

	if (monitorType === 'smtp') {
		const { user, pass, ...rest } = options;
		return user === undefined && pass === undefined ? rest : { ...rest, auth: { user, pass } };
	}

	if (monitorType === 'ftp' && typeof options.secure === 'string') {
		const secure = options.secure === 'implicit' ? 'implicit' : options.secure === 'true';
		return { ...options, secure };
	}

	return options;
}

export const executeMonitor: ResourceExecute = async function (this, operation, itemIndex) {
	const monitorType = this.getNodeParameter('monitorType', itemIndex) as string;
	const basePath = MONITOR_PATHS[monitorType];

	if (basePath === undefined) {
		throw new NodeOperationError(this.getNode(), `Unknown monitor type "${monitorType}"`, {
			itemIndex,
		});
	}

	if (operation === 'create' || operation === 'update') {
		const common = this.getNodeParameter('commonFields', itemIndex) as IDataObject;
		const body: IDataObject = { ...common };

		if (operation === 'create') {
			body.customerId = this.getNodeParameter('customerId', itemIndex, undefined, {
				extractValue: true,
			}) as string;
			body.name = this.getNodeParameter('name', itemIndex) as string;
			body.hostname = this.getNodeParameter('hostname', itemIndex) as string;

			if (monitorType === 'tcp') body.port = this.getNodeParameter('port', itemIndex) as number;
		}

		if (['smtp', 'ssh', 'ftp', 'imap-pop'].includes(monitorType)) {
			body.checkMode = this.getNodeParameter('checkMode', itemIndex) as string;
		}

		if (body.checkMode !== 'tcp') {
			const config = buildConfig(this, monitorType, itemIndex);
			if (config !== undefined) body[MONITOR_CONFIG_KEYS[monitorType]] = config;
		}

		if (operation === 'create') {
			return (await uptimeifyApiRequest.call(this, 'POST', basePath, body)) as IDataObject;
		}

		const monitorId = this.getNodeParameter('monitorId', itemIndex, undefined, {
			extractValue: true,
		}) as string;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`${basePath}/${monitorId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			basePath,
			{},
			{
				mode: 'page',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const monitorId = this.getNodeParameter('monitorId', itemIndex, undefined, {
		extractValue: true,
	}) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(this, 'GET', `${basePath}/${monitorId}`)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `${basePath}/${monitorId}`);
		return { success: true, monitorId };
	}

	if (operation === 'triggerCheck') {
		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`${basePath}/${monitorId}/trigger-check`,
			{},
		)) as IDataObject;
	}

	const historyPaths: Record<string, string> = {
		getCheckHistory: 'check-history',
		getAlertHistory: 'alert-history',
		getIncidentHistory: 'incident-history',
	};

	const segment = historyPaths[operation];

	if (segment !== undefined) {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const limit = returnAll ? 200 : (this.getNodeParameter('limit', itemIndex) as number);

		const rows = await uptimeifyApiRequestAllItems.call(
			this,
			`${basePath}/${monitorId}/${segment}`,
			{ limit: Math.min(limit, 200) },
			{ mode: 'array', limit: returnAll ? undefined : limit },
		);

		return rows;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for monitors`,
		{ itemIndex },
	);
};
```

- [ ] **Step 3: Ressource im Node registrieren**

In `nodes/Uptimeify/Uptimeify.node.ts`:

```ts
import { monitorDescription } from './resources/monitor';
import { executeMonitor } from './resources/monitor/execute';
```

`RESOURCE_EXECUTORS` ergänzen:

```ts
const RESOURCE_EXECUTORS: Record<string, ResourceExecute> = {
	monitor: executeMonitor,
	website: executeWebsite,
};
```

Im Property `resource` die Option ergänzen (alphabetisch, Monitor vor Website) und
`...monitorDescription` in `properties` aufnehmen:

```ts
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Monitor', value: 'monitor' },
					{ name: 'Website', value: 'website' },
				],
				default: 'website',
			},
			...monitorDescription,
			...websiteDescription,
```

- [ ] **Step 4: Bauen und linten**

Run: `npm run build && npm run lint`
Expected: Build erfolgreich, Lint ohne Fehler und ohne Warnungen.

- [ ] **Step 5: Commit**

```bash
git add nodes/Uptimeify
git commit -m "feat: add the monitor resource for all seven service monitor types

One monitor type parameter picks the endpoint prefix and the name of the config
object in the body. DNS expected values are entered per record type; the
credentialed types offer TCP check mode, which stores no credentials.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---
### Task 8: Ressourcen *Customer*, *Customer Domain*, *Customer IP*

Drei Ressourcen in einer Aufgabe, weil Domains und IPs unter dem Kunden angelegt werden und die
drei zusammen erst einen sinnvollen Durchstich ergeben.

**Files:**
- Create: `nodes/Uptimeify/resources/customer/index.ts`, `.../customer/execute.ts`
- Create: `nodes/Uptimeify/resources/customerDomain/index.ts`, `.../customerDomain/execute.ts`
- Create: `nodes/Uptimeify/resources/customerIp/index.ts`, `.../customerIp/execute.ts`
- Modify: `nodes/Uptimeify/Uptimeify.node.ts`

**Interfaces:**
- Consumes: `ResourceExecute`, `customerLocator`, `returnAllProperties`, Transport
- Produces: `customerDescription` / `executeCustomer`, `customerDomainDescription` / `executeCustomerDomain`, `customerIpDescription` / `executeCustomerIp`

Endpunkte, verifiziert am Routen-Baum:

| Operation | Methode und Pfad |
|---|---|
| Customer: Get Many | `GET /api/customers` (nacktes Array, `fields=minimal` optional) |
| Customer: Create | `POST /api/customers` |
| Customer: Get | `GET /api/customers/:customerPublicId` |
| Customer: Update | `PATCH /api/customers/:customerPublicId` |
| Customer: Bulk Action | `POST /api/customers/bulk` |
| Customer: Get SMS Usage | `GET /api/customers/sms-usage` |
| Customer Domain: Create | `POST /api/customers/:customerPublicId/domains` |
| Customer Domain: Get Many | `GET /api/customer-domains` (Seiten-Pagination) |
| Customer Domain: Get / Update / Delete | `GET|PATCH|DELETE /api/customer-domains/:id` |
| Customer IP: Create | `POST /api/customers/:customerPublicId/ips` |
| Customer IP: Get Many | `GET /api/customer-ips` (Seiten-Pagination) |
| Customer IP: Get / Update / Delete | `GET|PATCH|DELETE /api/customer-ips/:id` |

- [ ] **Step 1: Ressource Customer schreiben**

`nodes/Uptimeify/resources/customer/index.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['customer'], operation: [operation] });

export const customerDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['customer'] } },
		options: [
			{ name: 'Bulk Action', value: 'bulk', action: 'Run a bulk action on customers' },
			{ name: 'Create', value: 'create', action: 'Create a customer' },
			{ name: 'Get', value: 'get', action: 'Get a customer' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many customers' },
			{ name: 'Get SMS Usage', value: 'getSmsUsage', action: 'Get SMS usage' },
			{ name: 'Update', value: 'update', action: 'Update a customer' },
		],
		default: 'getAll',
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		required: true,
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Package Type',
		name: 'packageType',
		type: 'string',
		default: '',
		required: true,
		description: 'Package key or display name configured for your organization',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('create') },
		options: [
			{
				displayName: 'Allow Self Service',
				name: 'allowSelfService',
				type: 'boolean',
				default: false,
				description: 'Whether the customer may create self-service monitors',
			},
			{
				displayName: 'Can Edit Managed',
				name: 'canEditManaged',
				type: 'boolean',
				default: false,
				description: 'Whether the customer may edit managed monitors',
			},
			{
				displayName: 'Max Self Service URLs',
				name: 'maxSelfServiceUrls',
				type: 'number',
				default: 0,
				description: 'Cap across all monitor types. Zero means inherit from the package.',
			},
			{
				displayName: 'Monthly Reports Enabled',
				name: 'monthlyReportsEnabled',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
				],
				default: 'active',
			},
		],
	},

	{
		...customerLocator,
		displayOptions: { show: { resource: ['customer'], operation: ['get', 'update'] } },
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('update') },
		options: [
			{ displayName: 'Email', name: 'email', type: 'string', placeholder: 'name@email.com', default: '' },
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Package Type', name: 'packageType', type: 'string', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
				],
				default: 'active',
			},
		],
	},

	{
		displayName: 'Action',
		name: 'bulkAction',
		type: 'string',
		default: '',
		required: true,
		description: 'Bulk action name as documented under Customer Management, Bulk Actions',
		displayOptions: { show: show('bulk') },
	},
	{
		displayName: 'Customer IDs',
		name: 'bulkCustomerIds',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 101,102,103',
		description: 'Comma-separated customer IDs, at most 200',
		displayOptions: { show: show('bulk') },
	},

	...returnAllProperties('customer', 'getAll'),
	{
		displayName: 'Minimal Fields',
		name: 'minimal',
		type: 'boolean',
		default: false,
		description:
			'Whether to return only ID, public ID, name, status and custom fields. Much smaller responses.',
		displayOptions: { show: show('getAll') },
	},
];
```

`nodes/Uptimeify/resources/customer/execute.ts`:

```ts
import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeCustomer: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const body: IDataObject = {
			name: this.getNodeParameter('name', itemIndex) as string,
			email: this.getNodeParameter('email', itemIndex) as string,
			packageType: this.getNodeParameter('packageType', itemIndex) as string,
			...(this.getNodeParameter('additionalFields', itemIndex) as IDataObject),
		};

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/customers', body)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const minimal = this.getNodeParameter('minimal', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/customers',
			minimal ? { fields: 'minimal' } : {},
			{
				mode: 'array',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	if (operation === 'getSmsUsage') {
		return (await uptimeifyApiRequest.call(this, 'GET', '/api/customers/sms-usage')) as IDataObject;
	}

	if (operation === 'bulk') {
		const ids = (this.getNodeParameter('bulkCustomerIds', itemIndex) as string)
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id !== '')
			.map((id) => Number(id));

		const body: IDataObject = {
			action: this.getNodeParameter('bulkAction', itemIndex) as string,
			customerIds: ids,
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			'/api/customers/bulk',
			body,
		)) as IDataObject;
	}

	const customerId = this.getNodeParameter('customerId', itemIndex, undefined, {
		extractValue: true,
	}) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/customers/${customerId}`,
		)) as IDataObject;
	}

	if (operation === 'update') {
		const body = this.getNodeParameter('updateFields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/customers/${customerId}`,
			body,
		)) as IDataObject;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for customers`,
		{ itemIndex },
	);
};
```

- [ ] **Step 2: Ressource Customer Domain schreiben**

`nodes/Uptimeify/resources/customerDomain/index.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['customerDomain'], operation: [operation] });

export const customerDomainDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['customerDomain'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a customer domain' },
			{ name: 'Delete', value: 'delete', action: 'Delete a customer domain' },
			{ name: 'Get', value: 'get', action: 'Get a customer domain' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many customer domains' },
			{ name: 'Update', value: 'update', action: 'Update a customer domain' },
		],
		default: 'getAll',
	},

	{ ...customerLocator, displayOptions: { show: show('create') } },
	{
		displayName: 'Domain Name',
		name: 'domainName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. example.com',
		description: 'Domain without a protocol and without a path',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Domain ID',
		name: 'domainId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['customerDomain'], operation: ['delete', 'get', 'update'] },
		},
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['customerDomain'], operation: ['create', 'update'] },
		},
		options: [
			{
				displayName: 'Domain Name',
				name: 'domainName',
				type: 'string',
				default: '',
				description: 'Only used when updating',
			},
			{ displayName: 'Expiry Error Days', name: 'expiryErrorDays', type: 'number', default: 7 },
			{ displayName: 'Expiry Warning Days', name: 'expiryWarningDays', type: 'number', default: 30 },
			{ displayName: 'Label', name: 'label', type: 'string', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
				],
				default: 'active',
			},
		],
	},

	...returnAllProperties('customerDomain', 'getAll'),
];
```

`nodes/Uptimeify/resources/customerDomain/execute.ts`:

```ts
import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeCustomerDomain: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const customerId = this.getNodeParameter('customerId', itemIndex, undefined, {
			extractValue: true,
		}) as string;

		const body: IDataObject = {
			domainName: this.getNodeParameter('domainName', itemIndex) as string,
			...(this.getNodeParameter('fields', itemIndex) as IDataObject),
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/customers/${customerId}/domains`,
			body,
		)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/customer-domains',
			{},
			{
				mode: 'page',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const domainId = this.getNodeParameter('domainId', itemIndex) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/customer-domains/${domainId}`,
		)) as IDataObject;
	}

	if (operation === 'update') {
		const body = this.getNodeParameter('fields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/customer-domains/${domainId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/customer-domains/${domainId}`);
		return { success: true, domainId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for customer domains`,
		{ itemIndex },
	);
};
```

- [ ] **Step 3: Ressource Customer IP schreiben**

`nodes/Uptimeify/resources/customerIp/index.ts`: identisch aufgebaut zur Domain-Ressource,
mit diesen Abweichungen:

```ts
import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['customerIp'], operation: [operation] });

export const customerIpDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['customerIp'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a customer IP' },
			{ name: 'Delete', value: 'delete', action: 'Delete a customer IP' },
			{ name: 'Get', value: 'get', action: 'Get a customer IP' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many customer IPs' },
			{ name: 'Update', value: 'update', action: 'Update a customer IP' },
		],
		default: 'getAll',
	},

	{ ...customerLocator, displayOptions: { show: show('create') } },
	{
		displayName: 'IP Address',
		name: 'ipAddress',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 203.0.113.10',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'IP ID',
		name: 'ipId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['customerIp'], operation: ['delete', 'get', 'update'] } },
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['customerIp'], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'IP Family',
				name: 'ipFamily',
				type: 'options',
				options: [
					{ name: 'IPv4', value: 'v4' },
					{ name: 'IPv6', value: 'v6' },
				],
				default: 'v4',
				description: 'Inferred from the address when omitted. Has to match the address.',
			},
			{ displayName: 'Label', name: 'label', type: 'string', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
				],
				default: 'active',
			},
		],
	},

	...returnAllProperties('customerIp', 'getAll'),
];
```

`nodes/Uptimeify/resources/customerIp/execute.ts`:

```ts
import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeCustomerIp: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const customerId = this.getNodeParameter('customerId', itemIndex, undefined, {
			extractValue: true,
		}) as string;

		const body: IDataObject = {
			ipAddress: this.getNodeParameter('ipAddress', itemIndex) as string,
			...(this.getNodeParameter('fields', itemIndex) as IDataObject),
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/customers/${customerId}/ips`,
			body,
		)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/customer-ips',
			{},
			{
				mode: 'page',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const ipId = this.getNodeParameter('ipId', itemIndex) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/customer-ips/${ipId}`,
		)) as IDataObject;
	}

	if (operation === 'update') {
		const body = this.getNodeParameter('fields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/customer-ips/${ipId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/customer-ips/${ipId}`);
		return { success: true, ipId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for customer IPs`,
		{ itemIndex },
	);
};
```

- [ ] **Step 4: Ressourcen im Node registrieren**

Importe ergänzen, `RESOURCE_EXECUTORS` um `customer`, `customerDomain`, `customerIp` erweitern,
die drei Optionen im `resource`-Property alphabetisch einsortieren (Customer, Customer Domain,
Customer IP, Monitor, Website) und die drei Description-Arrays in `properties` aufnehmen.

- [ ] **Step 5: Bauen und linten**

Run: `npm run build && npm run lint`
Expected: Build erfolgreich, Lint ohne Fehler und ohne Warnungen.

- [ ] **Step 6: Commit**

```bash
git add nodes/Uptimeify
git commit -m "feat: add customer, customer domain and customer IP resources

Domain expiry and DNSBL monitoring live under the customer, not under a monitor
endpoint of their own, so they follow the customer resource.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---
