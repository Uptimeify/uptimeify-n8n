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
2. Offset — nacktes Array, Query `limit` (max 500) + `offset`. Nur `/api/incidents`.
   `includeTotal` wird bewusst nicht gesetzt: mit diesem Parameter antwortet der Endpunkt
   `{ incidents, total, limit, offset }` statt einem Array, und der Abbruch über die
   Seitenlänge funktioniert ohne ihn genauso.
3. Cursor — Antwort `{ items, nextCursor }`, Query `limit` (max 100) + `cursor`.
   Nur `/api/im/incidents`.
4. Nacktes Array ohne Query-Pagination. `/api/customers`, `/api/tags`,
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
  - `uptimeifyApiRequestAllItems(this: UptimeifyContext, path: string, qs: IDataObject, options: { mode: 'page' | 'offset' | 'cursor' | 'array'; limit?: number }): Promise<IDataObject[]>`
  - `cleanQuery(qs: IDataObject): IDataObject`
  - `extractItems(response: unknown): IDataObject[]`
  - `MAX_PER_PAGE = 200`, `MAX_CURSOR_LIMIT = 100`, `MAX_OFFSET_LIMIT = 500`

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

/** Page size ceiling of the offset-paginated monitoring incidents endpoint. */
export const MAX_OFFSET_LIMIT = 500;

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
 * pagination dialect: `page` uses page/perPage, `offset` uses limit/offset, `cursor` uses
 * limit/cursor, `array` means the endpoint answers with everything at once.
 */
export async function uptimeifyApiRequestAllItems(
	this: UptimeifyContext,
	path: string,
	qs: IDataObject,
	options: { mode: 'page' | 'offset' | 'cursor' | 'array'; limit?: number },
): Promise<IDataObject[]> {
	const { mode, limit } = options;
	const collected: IDataObject[] = [];

	if (mode === 'array') {
		const response = await uptimeifyApiRequest.call(this, 'GET', path, undefined, qs);
		const items = extractItems(response);
		return limit === undefined ? items : items.slice(0, limit);
	}

	if (mode === 'offset') {
		let offset = 0;

		for (;;) {
			const response = await uptimeifyApiRequest.call(this, 'GET', path, undefined, {
				...qs,
				limit: MAX_OFFSET_LIMIT,
				offset,
			});
			const items = extractItems(response);
			collected.push(...items);

			if (items.length < MAX_OFFSET_LIMIT) break;
			if (limit !== undefined && collected.length >= limit) break;
			offset += MAX_OFFSET_LIMIT;
		}

		return limit === undefined ? collected : collected.slice(0, limit);
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
### Task 9: Ressourcen *Incident* und *Status Page*

**Files:**
- Create: `nodes/Uptimeify/resources/incident/index.ts`, `.../incident/execute.ts`
- Create: `nodes/Uptimeify/resources/statusPage/index.ts`, `.../statusPage/execute.ts`
- Modify: `nodes/Uptimeify/Uptimeify.node.ts`

**Interfaces:**
- Consumes: `ResourceExecute`, `customerLocator`, `returnAllProperties`, Transport
- Produces: `incidentDescription` / `executeIncident`, `statusPageDescription` / `executeStatusPage`

- [ ] **Step 1: Ressource Incident schreiben**

`nodes/Uptimeify/resources/incident/index.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';
import { returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['incident'], operation: [operation] });

export const incidentDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['incident'] } },
		options: [
			{ name: 'Delete', value: 'delete', action: 'Delete a manual incident' },
			{ name: 'Get', value: 'get', action: 'Get an incident' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many incidents' },
		],
		default: 'getAll',
	},
	{
		displayName: 'Incident ID',
		name: 'incidentId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['incident'], operation: ['delete', 'get'] } },
	},
	...returnAllProperties('incident', 'getAll'),
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		options: [
			{ name: 'Any', value: '' },
			{ name: 'Manual (Status Page)', value: 'manual' },
			{ name: 'Monitor', value: 'monitor' },
		],
		default: '',
		description:
			'Manual incidents can be much older than the newest monitor incidents, so filtering keeps them from falling outside the window',
		displayOptions: { show: show('getAll') },
	},
];
```

`nodes/Uptimeify/resources/incident/execute.ts`:

```ts
import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeIncident: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const source = this.getNodeParameter('source', itemIndex) as string;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/incidents',
			{ source },
			{
				mode: 'offset',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const incidentId = this.getNodeParameter('incidentId', itemIndex) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/incidents/${incidentId}`,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/incidents/${incidentId}`);
		return { success: true, incidentId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for incidents`,
		{ itemIndex },
	);
};
```

- [ ] **Step 2: Ressource Status Page schreiben**

`nodes/Uptimeify/resources/statusPage/index.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['statusPage'], operation: [operation] });

export const statusPageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['statusPage'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a status page' },
			{ name: 'Delete', value: 'delete', action: 'Delete a status page' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many status pages' },
			{ name: 'Update', value: 'update', action: 'Update a status page' },
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
		description: 'Display name, 1 to 120 characters. The slug is derived from it.',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Status Page ID',
		name: 'statusPageId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['statusPage'], operation: ['delete', 'update'] } },
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['statusPage'], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'Custom Domain Hostname',
				name: 'customDomainHostname',
				type: 'string',
				default: '',
				description: 'Creates a pending DNS verification record',
			},
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			{ displayName: 'Is Published', name: 'isPublished', type: 'boolean', default: true },
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Only used when updating',
			},
			{ displayName: 'Show Recent Incidents', name: 'showRecentIncidents', type: 'boolean', default: false },
			{
				displayName: 'Show Recent Maintenance',
				name: 'showRecentMaintenance',
				type: 'boolean',
				default: false,
			},
			{ displayName: 'Slug', name: 'slug', type: 'string', default: '' },
			{
				displayName: 'Visibility',
				name: 'visibility',
				type: 'options',
				options: [
					{ name: 'Customer Members Only', value: 'customer_members_only' },
					{ name: 'Public', value: 'public' },
				],
				default: 'public',
			},
		],
	},

	...returnAllProperties('statusPage', 'getAll'),
];
```

`nodes/Uptimeify/resources/statusPage/execute.ts`:

```ts
import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeStatusPage: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const body: IDataObject = {
			customerId: this.getNodeParameter('customerId', itemIndex, undefined, {
				extractValue: true,
			}) as string,
			name: this.getNodeParameter('name', itemIndex) as string,
			...(this.getNodeParameter('fields', itemIndex) as IDataObject),
		};

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/status-pages', body)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/status-pages',
			{},
			{
				mode: 'array',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const statusPageId = this.getNodeParameter('statusPageId', itemIndex) as string;

	if (operation === 'update') {
		const body = this.getNodeParameter('fields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/status-pages/${statusPageId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/status-pages/${statusPageId}`);
		return { success: true, statusPageId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for status pages`,
		{ itemIndex },
	);
};
```

**Hinweis:** `POST /api/status-pages` antwortet mit `{ statusPage: {...}, dns: null }`, nicht
mit der Seite selbst. Das Ergebnis wird unverändert durchgereicht — der Workflow greift dann
auf `$json.statusPage.id` zu. Das steht so im README.

- [ ] **Step 3: Ressourcen im Node registrieren**

Importe ergänzen, `RESOURCE_EXECUTORS` um `incident` und `statusPage` erweitern, die Optionen
im `resource`-Property alphabetisch einsortieren, die Description-Arrays in `properties`
aufnehmen.

- [ ] **Step 4: Bauen und linten**

Run: `npm run build && npm run lint`
Expected: Build erfolgreich, Lint ohne Fehler und ohne Warnungen.

- [ ] **Step 5: Commit**

```bash
git add nodes/Uptimeify
git commit -m "feat: add incident and status page resources

Incidents paginate with limit and offset. Only manual status-page incidents can
be deleted; the API rejects the rest with notManualIncident, which the error
mapper already explains.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---
### Task 10: Ressourcen *Maintenance Window*, *Notification Channel*, *Tag*

**Files:**
- Create: `nodes/Uptimeify/resources/maintenanceWindow/index.ts`, `.../maintenanceWindow/execute.ts`
- Create: `nodes/Uptimeify/resources/notificationChannel/index.ts`, `.../notificationChannel/execute.ts`
- Create: `nodes/Uptimeify/resources/tag/index.ts`, `.../tag/execute.ts`
- Modify: `nodes/Uptimeify/Uptimeify.node.ts`

**Interfaces:**
- Consumes: `ResourceExecute`, `customerLocator`, `tagLocator`, `returnAllProperties`, Transport
- Produces: `maintenanceWindowDescription` / `executeMaintenanceWindow`, `notificationChannelDescription` / `executeNotificationChannel`, `tagDescription` / `executeTag`

- [ ] **Step 1: Ressource Maintenance Window schreiben**

`nodes/Uptimeify/resources/maintenanceWindow/index.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['maintenanceWindow'], operation: [operation] });
const WRITE = ['create', 'previewOccurrences'];

export const maintenanceWindowDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['maintenanceWindow'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a maintenance window' },
			{ name: 'Delete', value: 'delete', action: 'Delete a maintenance window' },
			{ name: 'Get', value: 'get', action: 'Get a maintenance window' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many maintenance windows' },
			{
				name: 'Preview Occurrences',
				value: 'previewOccurrences',
				action: 'Preview maintenance window occurrences',
			},
			{ name: 'Update', value: 'update', action: 'Update a maintenance window' },
		],
		default: 'getAll',
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['maintenanceWindow'], operation: WRITE } },
	},
	{
		displayName: 'Start Time',
		name: 'startTime',
		type: 'dateTime',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['maintenanceWindow'], operation: WRITE } },
	},
	{
		displayName: 'End Time',
		name: 'endTime',
		type: 'dateTime',
		default: '',
		required: true,
		description: 'Has to be after the start time',
		displayOptions: { show: { resource: ['maintenanceWindow'], operation: WRITE } },
	},
	{
		displayName: 'Targeting',
		name: 'targeting',
		type: 'options',
		options: [
			{ name: 'Customer', value: 'customer', description: 'Every monitor of one customer' },
			{ name: 'Monitors', value: 'targets', description: 'An explicit list of monitors' },
			{
				name: 'Tags',
				value: 'tags',
				description: 'Every monitor across the organization carrying these tags',
			},
		],
		default: 'targets',
		required: true,
		description: 'Exactly one targeting mode has to be used',
		displayOptions: { show: { resource: ['maintenanceWindow'], operation: WRITE } },
	},
	{
		...customerLocator,
		displayOptions: {
			show: {
				resource: ['maintenanceWindow'],
				operation: WRITE,
				targeting: ['customer'],
			},
		},
	},
	{
		displayName: 'Targets',
		name: 'targets',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Target',
		default: {},
		displayOptions: {
			show: { resource: ['maintenanceWindow'], operation: WRITE, targeting: ['targets'] },
		},
		options: [
			{
				displayName: 'Target',
				name: 'target',
				values: [
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: [
							{ name: 'Customer Domain', value: 'customer_domain' },
							{ name: 'Customer IP', value: 'customer_ip' },
							{ name: 'DNS', value: 'dns' },
							{ name: 'FTP', value: 'ftp' },
							{ name: 'ICMP', value: 'icmp' },
							{ name: 'IMAP/POP', value: 'imap_pop' },
							{ name: 'SMTP', value: 'smtp' },
							{ name: 'SSH', value: 'ssh' },
							{ name: 'Website', value: 'website' },
						],
						default: 'website',
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						default: '',
						description: 'Public UUID of the monitor. A numeric row ID is also accepted.',
					},
				],
			},
		],
	},
	{
		displayName: 'Tag IDs',
		name: 'tagIds',
		type: 'string',
		default: '',
		placeholder: 'e.g. 7,12',
		description: 'Comma-separated numeric tag IDs',
		displayOptions: {
			show: { resource: ['maintenanceWindow'], operation: WRITE, targeting: ['tags'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['maintenanceWindow'], operation: WRITE } },
		options: [
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			{ displayName: 'Is Active', name: 'isActive', type: 'boolean', default: true },
			{ displayName: 'Is Recurring', name: 'isRecurring', type: 'boolean', default: false },
		],
	},

	{
		displayName: 'Maintenance Window ID',
		name: 'maintenanceWindowId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['maintenanceWindow'], operation: ['delete', 'get', 'update'] },
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('update') },
		options: [
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			{ displayName: 'End Time', name: 'endTime', type: 'dateTime', default: '' },
			{ displayName: 'Is Active', name: 'isActive', type: 'boolean', default: true },
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Start Time', name: 'startTime', type: 'dateTime', default: '' },
		],
	},

	...returnAllProperties('maintenanceWindow', 'getAll'),
];
```

`nodes/Uptimeify/resources/maintenanceWindow/execute.ts`:

```ts
import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

type TargetEntry = { type: string; id: string };

/** Shared by Create and Preview Occurrences, which take the same body. */
function buildWindowBody(context: IExecuteFunctions, itemIndex: number): IDataObject {
	const body: IDataObject = {
		name: context.getNodeParameter('name', itemIndex) as string,
		startTime: context.getNodeParameter('startTime', itemIndex) as string,
		endTime: context.getNodeParameter('endTime', itemIndex) as string,
		...(context.getNodeParameter('additionalFields', itemIndex) as IDataObject),
	};

	const targeting = context.getNodeParameter('targeting', itemIndex) as string;

	if (targeting === 'customer') {
		body.customerId = context.getNodeParameter('customerId', itemIndex, undefined, {
			extractValue: true,
		}) as string;
	}

	if (targeting === 'targets') {
		const entries = ((context.getNodeParameter('targets', itemIndex) as IDataObject).target ??
			[]) as unknown as TargetEntry[];
		body.targets = entries.map((entry) => ({ type: entry.type, id: entry.id }));
	}

	if (targeting === 'tags') {
		body.tagIds = (context.getNodeParameter('tagIds', itemIndex) as string)
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id !== '')
			.map((id) => Number(id));
	}

	return body;
}

export const executeMaintenanceWindow: ResourceExecute = async function (
	this,
	operation,
	itemIndex,
) {
	if (operation === 'create') {
		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			'/api/maintenance-windows',
			buildWindowBody(this, itemIndex),
		)) as IDataObject;
	}

	if (operation === 'previewOccurrences') {
		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			'/api/maintenance-windows/preview-occurrences',
			buildWindowBody(this, itemIndex),
		)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/maintenance-windows',
			{},
			{
				mode: 'page',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const windowId = this.getNodeParameter('maintenanceWindowId', itemIndex) as string;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/maintenance-windows/${windowId}`,
		)) as IDataObject;
	}

	if (operation === 'update') {
		const body = this.getNodeParameter('updateFields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/maintenance-windows/${windowId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/maintenance-windows/${windowId}`);
		return { success: true, maintenanceWindowId: windowId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for maintenance windows`,
		{ itemIndex },
	);
};
```

- [ ] **Step 2: Ressource Notification Channel schreiben**

`nodes/Uptimeify/resources/notificationChannel/index.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['notificationChannel'], operation: [operation] });

export const notificationChannelDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['notificationChannel'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a notification channel' },
			{ name: 'Delete', value: 'delete', action: 'Delete a notification channel' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many notification channels' },
			{ name: 'Test', value: 'test', action: 'Test a notification channel' },
			{ name: 'Update', value: 'update', action: 'Update a notification channel' },
		],
		default: 'getAll',
	},

	{
		displayName: 'Type',
		name: 'type',
		type: 'string',
		default: 'webhook',
		required: true,
		placeholder: 'e.g. webhook, email, slack, pagerduty',
		description:
			'Direct types are email, sms and webhook. Integration types include slack, discord, teams, pagerduty, opsgenie, telegram, jira and more.',
		displayOptions: { show: show('create') },
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
		displayName: 'Config',
		name: 'config',
		type: 'json',
		default: '{}',
		required: true,
		description:
			'Channel configuration. The fields depend on the type, e.g. { "url": "..." } for a webhook or { "secret": "https://hooks.slack.com/..." } for Slack.',
		displayOptions: { show: { resource: ['notificationChannel'], operation: ['create', 'test'] } },
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
				displayName: 'Category',
				name: 'category',
				type: 'options',
				options: [
					{ name: 'Direct', value: 'direct' },
					{ name: 'Integration', value: 'integration' },
				],
				default: 'direct',
			},
			{ ...customerLocator, required: false },
			{ displayName: 'Delay (Seconds)', name: 'delaySeconds', type: 'number', default: 0 },
			{ displayName: 'Is Active', name: 'isActive', type: 'boolean', default: true },
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'number',
				default: 1,
				description: 'Lower numbers are higher priority',
			},
		],
	},

	{
		displayName: 'Channel ID',
		name: 'channelId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['notificationChannel'], operation: ['delete', 'update'] } },
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('update') },
		options: [
			{ displayName: 'Config (JSON)', name: 'config', type: 'json', default: '{}' },
			{ displayName: 'Delay (Seconds)', name: 'delaySeconds', type: 'number', default: 0 },
			{ displayName: 'Is Active', name: 'isActive', type: 'boolean', default: true },
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Priority', name: 'priority', type: 'number', default: 1 },
		],
	},
	{
		displayName: 'Type',
		name: 'testType',
		type: 'string',
		default: 'webhook',
		required: true,
		description: 'Incident Management channels cannot be tested',
		displayOptions: { show: show('test') },
	},

	...returnAllProperties('notificationChannel', 'getAll'),
];
```

`nodes/Uptimeify/resources/notificationChannel/execute.ts`:

```ts
import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

function parseJsonParameter(raw: unknown): IDataObject {
	if (typeof raw !== 'string') return (raw ?? {}) as IDataObject;
	return JSON.parse(raw) as IDataObject;
}

export const executeNotificationChannel: ResourceExecute = async function (
	this,
	operation,
	itemIndex,
) {
	if (operation === 'create') {
		const additional = this.getNodeParameter('additionalFields', itemIndex) as IDataObject;

		if (typeof additional.customerId === 'object' && additional.customerId !== null) {
			additional.customerId = (additional.customerId as { value?: string }).value;
		}

		const body: IDataObject = {
			type: this.getNodeParameter('type', itemIndex) as string,
			name: this.getNodeParameter('name', itemIndex) as string,
			config: parseJsonParameter(this.getNodeParameter('config', itemIndex)),
			...additional,
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			'/api/notification-channels',
			body,
		)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/notification-channels',
			{},
			{
				mode: 'array',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	if (operation === 'test') {
		const body: IDataObject = {
			type: this.getNodeParameter('testType', itemIndex) as string,
			config: parseJsonParameter(this.getNodeParameter('config', itemIndex)),
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			'/api/notification-channels/test',
			body,
		)) as IDataObject;
	}

	const channelId = this.getNodeParameter('channelId', itemIndex) as string;

	if (operation === 'update') {
		const body = this.getNodeParameter('updateFields', itemIndex) as IDataObject;
		if (body.config !== undefined) body.config = parseJsonParameter(body.config);

		return (await uptimeifyApiRequest.call(
			this,
			'PATCH',
			`/api/notification-channels/${channelId}`,
			body,
		)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/notification-channels/${channelId}`);
		return { success: true, channelId };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for notification channels`,
		{ itemIndex },
	);
};
```

- [ ] **Step 3: Ressource Tag schreiben**

`nodes/Uptimeify/resources/tag/index.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';
import { returnAllProperties, tagLocator } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['tag'], operation: [operation] });
const ASSIGNMENT = ['assign', 'remove'];

const COLOR_OPTIONS = [
	{ name: 'Amber', value: 'amber' },
	{ name: 'Blue', value: 'blue' },
	{ name: 'Gray', value: 'gray' },
	{ name: 'Green', value: 'green' },
	{ name: 'Indigo', value: 'indigo' },
	{ name: 'Pink', value: 'pink' },
	{ name: 'Red', value: 'red' },
	{ name: 'Slate', value: 'slate' },
	{ name: 'Teal', value: 'teal' },
	{ name: 'Violet', value: 'violet' },
];

export const tagDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['tag'] } },
		options: [
			{ name: 'Assign to Monitor', value: 'assign', action: 'Assign a tag to a monitor' },
			{ name: 'Create', value: 'create', action: 'Create a tag' },
			{ name: 'Delete', value: 'delete', action: 'Delete a tag' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many tags' },
			{ name: 'Remove From Monitor', value: 'remove', action: 'Remove a tag from a monitor' },
			{ name: 'Update', value: 'update', action: 'Update a tag' },
		],
		default: 'getAll',
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'Display label, at most 50 characters',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Color',
		name: 'color',
		type: 'options',
		options: COLOR_OPTIONS,
		default: 'blue',
		required: true,
		displayOptions: { show: show('create') },
	},

	{
		...tagLocator,
		displayOptions: {
			show: { resource: ['tag'], operation: ['assign', 'delete', 'remove', 'update'] },
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('update') },
		options: [
			{ displayName: 'Color', name: 'color', type: 'options', options: COLOR_OPTIONS, default: 'blue' },
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
		],
	},

	{
		displayName: 'Monitor Type',
		name: 'assignMonitorType',
		type: 'options',
		options: [
			{ name: 'Customer Domain', value: 'customer_domain' },
			{ name: 'Customer IP', value: 'customer_ip' },
			{ name: 'DNS', value: 'dns' },
			{ name: 'FTP', value: 'ftp' },
			{ name: 'ICMP', value: 'icmp' },
			{ name: 'IMAP/POP', value: 'imap_pop' },
			{ name: 'SMTP', value: 'smtp' },
			{ name: 'SSH', value: 'ssh' },
			{ name: 'TCP', value: 'tcp' },
			{ name: 'Website', value: 'website' },
		],
		default: 'website',
		required: true,
		description:
			'Use Customer Domain for domain expiry monitors and Customer IP for DNSBL monitors',
		displayOptions: { show: { resource: ['tag'], operation: ASSIGNMENT } },
	},
	{
		displayName: 'Monitor ID',
		name: 'assignMonitorId',
		type: 'number',
		default: 0,
		required: true,
		description: 'Numeric monitor ID. This endpoint does not accept public UUIDs.',
		displayOptions: { show: { resource: ['tag'], operation: ASSIGNMENT } },
	},

	...returnAllProperties('tag', 'getAll'),
];
```

`nodes/Uptimeify/resources/tag/execute.ts`:

```ts
import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeTag: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'create') {
		const body: IDataObject = {
			name: this.getNodeParameter('name', itemIndex) as string,
			color: this.getNodeParameter('color', itemIndex) as string,
		};

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/tags', body)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

		return await uptimeifyApiRequestAllItems.call(
			this,
			'/api/tags',
			{},
			{
				mode: 'array',
				limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
			},
		);
	}

	const tagId = Number(
		this.getNodeParameter('tagId', itemIndex, undefined, { extractValue: true }) as string | number,
	);

	if (operation === 'update') {
		const body = this.getNodeParameter('updateFields', itemIndex) as IDataObject;

		return (await uptimeifyApiRequest.call(this, 'PATCH', `/api/tags/${tagId}`, body)) as IDataObject;
	}

	if (operation === 'delete') {
		await uptimeifyApiRequest.call(this, 'DELETE', `/api/tags/${tagId}`);
		return { success: true, tagId };
	}

	if (operation === 'assign' || operation === 'remove') {
		const body: IDataObject = {
			monitorType: this.getNodeParameter('assignMonitorType', itemIndex) as string,
			monitorId: this.getNodeParameter('assignMonitorId', itemIndex) as number,
			tagId,
		};

		if (operation === 'assign') {
			return (await uptimeifyApiRequest.call(
				this,
				'POST',
				'/api/monitor-tags',
				body,
			)) as IDataObject;
		}

		await uptimeifyApiRequest.call(this, 'DELETE', '/api/monitor-tags', body);
		return { success: true, ...body };
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for tags`,
		{ itemIndex },
	);
};
```

- [ ] **Step 4: Ressourcen im Node registrieren**

Importe ergänzen, `RESOURCE_EXECUTORS` um `maintenanceWindow`, `notificationChannel` und `tag`
erweitern, Optionen alphabetisch einsortieren, Description-Arrays in `properties` aufnehmen.

- [ ] **Step 5: Bauen und linten**

Run: `npm run build && npm run lint`
Expected: Build erfolgreich, Lint ohne Fehler und ohne Warnungen.

- [ ] **Step 6: Commit**

```bash
git add nodes/Uptimeify
git commit -m "feat: add maintenance window, notification channel and tag resources

Maintenance windows take exactly one targeting mode, so the node offers it as a
choice instead of letting the API reject a mixed body. Tag assignment takes
numeric ids only, which the field description states.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---
### Task 11: Ressourcen *IM: Incident* und *IM: On-Call*

Beide Ressourcen brauchen einen **organisationsweiten** Token und eine Organisation mit
aktivem Incident Management. Der Fehler-Mapper aus Task 3 übersetzt `imAccessDenied` und
`imNotEnabled` bereits; hier kommt nur der Hinweis in den Feldbeschreibungen dazu.

**Files:**
- Create: `nodes/Uptimeify/resources/imIncident/index.ts`, `.../imIncident/execute.ts`
- Create: `nodes/Uptimeify/resources/imOnCall/index.ts`, `.../imOnCall/execute.ts`
- Modify: `nodes/Uptimeify/Uptimeify.node.ts`

**Interfaces:**
- Consumes: `ResourceExecute`, `teamLocator`, `customerLocator`, `returnAllProperties`, Transport
- Produces: `imIncidentDescription` / `executeImIncident`, `imOnCallDescription` / `executeImOnCall`

- [ ] **Step 1: Ressource IM: Incident schreiben**

`nodes/Uptimeify/resources/imIncident/index.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';
import { customerLocator, returnAllProperties, teamLocator } from '../../shared/descriptions';

const show = (operation: string) => ({ resource: ['imIncident'], operation: [operation] });

export const imIncidentDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['imIncident'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create an incident' },
			{ name: 'Get', value: 'get', action: 'Get an incident' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many incidents' },
			{ name: 'Ingest Event', value: 'ingestEvent', action: 'Ingest an alert event' },
			{ name: 'Resolve', value: 'resolve', action: 'Resolve an incident' },
			{ name: 'Update Status', value: 'updateStatus', action: 'Update an incident status' },
		],
		default: 'getAll',
	},

	{
		displayName: 'Payload',
		name: 'payload',
		type: 'json',
		default: '{}',
		required: true,
		description:
			'Any JSON your alerting system produces. At most 256 KB and 20 levels deep. The endpoint answers 202 without an incident ID; processing is asynchronous.',
		displayOptions: { show: show('ingestEvent') },
	},

	{ ...teamLocator, displayOptions: { show: show('create') } },
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		required: true,
		description: 'Up to 10,000 characters',
		displayOptions: { show: show('create') },
	},
	{
		displayName: 'Severity',
		name: 'severity',
		type: 'options',
		options: [
			{ name: 'SEV1', value: 'sev1' },
			{ name: 'SEV2', value: 'sev2' },
			{ name: 'SEV3', value: 'sev3' },
			{ name: 'SEV4', value: 'sev4' },
		],
		default: 'sev3',
		required: true,
		description: 'A manual incident has no alert stream to derive severity from',
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
			{ ...customerLocator, required: false },
			{
				displayName: 'Escalation Policy ID',
				name: 'escalationPolicyId',
				type: 'number',
				default: 0,
				description: "Omit to use the team's default policy",
			},
		],
	},

	{
		displayName: 'Incident ID',
		name: 'incidentId',
		type: 'number',
		default: 0,
		required: true,
		displayOptions: {
			show: { resource: ['imIncident'], operation: ['get', 'resolve', 'updateStatus'] },
		},
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: [
			{ name: 'Acknowledged', value: 'acknowledged' },
			{ name: 'Identified', value: 'identified' },
			{ name: 'Investigating', value: 'investigating' },
			{ name: 'Monitoring', value: 'monitoring' },
		],
		default: 'acknowledged',
		required: true,
		description: 'Resolving needs the Resolve operation; this one never reaches resolved',
		displayOptions: { show: show('updateStatus') },
	},
	{
		displayName: 'Note',
		name: 'note',
		type: 'string',
		default: '',
		description: 'Optional resolution note, up to 10,000 characters',
		displayOptions: { show: show('resolve') },
	},

	...returnAllProperties('imIncident', 'getAll'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: show('getAll') },
		options: [
			{
				displayName: 'From',
				name: 'from',
				type: 'dateTime',
				default: '',
				description: 'Only incidents triggered at or after this time',
			},
			{
				displayName: 'On Call',
				name: 'onCall',
				type: 'boolean',
				default: false,
				description: 'Whether to restrict to teams you are currently on call for',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Full-text search on the title, whole words only',
			},
			{
				displayName: 'Severity',
				name: 'severity',
				type: 'multiOptions',
				options: [
					{ name: 'SEV1', value: 'sev1' },
					{ name: 'SEV2', value: 'sev2' },
					{ name: 'SEV3', value: 'sev3' },
					{ name: 'SEV4', value: 'sev4' },
				],
				default: [],
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: [
					{ name: 'Acknowledged', value: 'acknowledged' },
					{ name: 'Identified', value: 'identified' },
					{ name: 'Investigating', value: 'investigating' },
					{ name: 'Merged', value: 'merged' },
					{ name: 'Monitoring', value: 'monitoring' },
					{ name: 'Resolved', value: 'resolved' },
					{ name: 'Triggered', value: 'triggered' },
				],
				default: [],
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'dateTime',
				default: '',
				description: 'Only incidents triggered at or before this time',
			},
		],
	},
];
```

`nodes/Uptimeify/resources/imIncident/execute.ts`:

```ts
import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeImIncident: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'ingestEvent') {
		const raw = this.getNodeParameter('payload', itemIndex);
		const payload = (typeof raw === 'string' ? JSON.parse(raw) : raw) as IDataObject;

		return (await uptimeifyApiRequest.call(this, 'POST', '/api/im/events', payload)) as IDataObject;
	}

	if (operation === 'create') {
		const additional = this.getNodeParameter('additionalFields', itemIndex) as IDataObject;

		if (typeof additional.customerId === 'object' && additional.customerId !== null) {
			additional.customerId = (additional.customerId as { value?: string }).value;
		}

		const body: IDataObject = {
			teamId: Number(
				this.getNodeParameter('teamId', itemIndex, undefined, { extractValue: true }) as
					| string
					| number,
			),
			title: this.getNodeParameter('title', itemIndex) as string,
			severity: this.getNodeParameter('severity', itemIndex) as string,
			...additional,
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			'/api/im/incidents',
			body,
		)) as IDataObject;
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const filters = this.getNodeParameter('filters', itemIndex) as IDataObject;

		return await uptimeifyApiRequestAllItems.call(this, '/api/im/incidents', filters, {
			mode: 'cursor',
			limit: returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number),
		});
	}

	const incidentId = this.getNodeParameter('incidentId', itemIndex) as number;

	if (operation === 'get') {
		return (await uptimeifyApiRequest.call(
			this,
			'GET',
			`/api/im/incidents/${incidentId}`,
		)) as IDataObject;
	}

	if (operation === 'updateStatus') {
		const body: IDataObject = { status: this.getNodeParameter('status', itemIndex) as string };

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/im/incidents/${incidentId}/status`,
			body,
		)) as IDataObject;
	}

	if (operation === 'resolve') {
		const note = this.getNodeParameter('note', itemIndex) as string;
		const body: IDataObject = note === '' ? {} : { note };

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/im/incidents/${incidentId}/resolve`,
			body,
		)) as IDataObject;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for Incident Management incidents`,
		{ itemIndex },
	);
};
```

- [ ] **Step 2: Ressource IM: On-Call schreiben**

`nodes/Uptimeify/resources/imOnCall/index.ts`:

```ts
import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string) => ({ resource: ['imOnCall'], operation: [operation] });

export const imOnCallDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['imOnCall'] } },
		options: [
			{
				name: 'Create Schedule Override',
				value: 'createOverride',
				action: 'Create a schedule override',
			},
			{ name: 'Get Schedules', value: 'getSchedules', action: 'Get on call schedules' },
			{ name: 'Get Teams', value: 'getTeams', action: 'Get teams' },
			{ name: 'Who Is on Call', value: 'whoIsOnCall', action: 'Get who is on call' },
		],
		default: 'whoIsOnCall',
	},
	{
		displayName: 'Schedule ID',
		name: 'scheduleId',
		type: 'number',
		default: 0,
		required: true,
		displayOptions: { show: show('createOverride') },
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. u_abc123',
		description: 'Has to belong to your organization',
		displayOptions: { show: show('createOverride') },
	},
	{
		displayName: 'Starts At',
		name: 'startsAt',
		type: 'dateTime',
		default: '',
		required: true,
		displayOptions: { show: show('createOverride') },
	},
	{
		displayName: 'Ends At',
		name: 'endsAt',
		type: 'dateTime',
		default: '',
		required: true,
		description: 'Has to be strictly after the start',
		displayOptions: { show: show('createOverride') },
	},
];
```

`nodes/Uptimeify/resources/imOnCall/execute.ts`:

```ts
import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { uptimeifyApiRequest, uptimeifyApiRequestAllItems } from '../../shared/transport';
import type { ResourceExecute } from '../../shared/types';

export const executeImOnCall: ResourceExecute = async function (this, operation, itemIndex) {
	if (operation === 'whoIsOnCall') {
		return await uptimeifyApiRequestAllItems.call(this, '/api/im/on-call', {}, { mode: 'array' });
	}

	if (operation === 'getTeams') {
		return await uptimeifyApiRequestAllItems.call(this, '/api/im/teams', {}, { mode: 'array' });
	}

	if (operation === 'getSchedules') {
		return await uptimeifyApiRequestAllItems.call(this, '/api/im/schedules', {}, { mode: 'array' });
	}

	if (operation === 'createOverride') {
		const scheduleId = this.getNodeParameter('scheduleId', itemIndex) as number;
		const body: IDataObject = {
			userId: this.getNodeParameter('userId', itemIndex) as string,
			startsAt: this.getNodeParameter('startsAt', itemIndex) as string,
			endsAt: this.getNodeParameter('endsAt', itemIndex) as string,
		};

		return (await uptimeifyApiRequest.call(
			this,
			'POST',
			`/api/im/schedules/${scheduleId}/overrides`,
			body,
		)) as IDataObject;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for on-call data`,
		{ itemIndex },
	);
};
```

- [ ] **Step 3: Ressourcen im Node registrieren**

Importe ergänzen, `RESOURCE_EXECUTORS` um `imIncident` und `imOnCall` erweitern. Im
`resource`-Property als *Incident Management: Incident* und *Incident Management: On-Call*
benennen, damit die Nähe zur Monitoring-Ressource *Incident* sichtbar bleibt.

- [ ] **Step 4: Bauen und linten**

Run: `npm run build && npm run lint`
Expected: Build erfolgreich, Lint ohne Fehler und ohne Warnungen.

- [ ] **Step 5: Commit**

```bash
git add nodes/Uptimeify
git commit -m "feat: add Incident Management incident and on-call resources

Incidents here paginate by cursor, unlike the monitoring incidents. Resolving is
its own endpoint because the status endpoint refuses resolved as a target.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---
### Task 12: Node `Uptimeify Trigger`

**Files:**
- Create: `nodes/UptimeifyTrigger/shared/signature.ts`, `nodes/UptimeifyTrigger/UptimeifyTrigger.node.ts`, `nodes/UptimeifyTrigger/UptimeifyTrigger.node.json`
- Test: `test/signature.test.ts`

**Interfaces:**
- Consumes: `uptimeifyApiRequest` (Task 4), Credential `uptimeifyApi` (Task 2)
- Produces:
  - `isValidSignature(rawBody: Buffer | string, headerValue: unknown, secret: string): boolean`
  - `createWebhookSecret(): string` — 32 zufällige Bytes, hex-kodiert

- [ ] **Step 1: Failing test schreiben**

`test/signature.test.ts`:

```ts
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run test/signature.test.ts`
Expected: FAIL, `Failed to resolve import "../nodes/UptimeifyTrigger/shared/signature"`.

- [ ] **Step 3: Implementierung schreiben**

`nodes/UptimeifyTrigger/shared/signature.ts`:

```ts
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
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run test/signature.test.ts`
Expected: 6 Tests PASS.

- [ ] **Step 5: Trigger-Node schreiben**

`nodes/UptimeifyTrigger/UptimeifyTrigger.node.ts`:

```ts
import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { extractItems, uptimeifyApiRequest } from '../Uptimeify/shared/transport';
import { createWebhookSecret, isValidSignature } from './shared/signature';

type ChannelRow = { id: number; config?: { url?: string } };

export class UptimeifyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Uptimeify Trigger',
		name: 'uptimeifyTrigger',
		icon: { light: 'file:../../icons/uptimeify.svg', dark: 'file:../../icons/uptimeify.dark.svg' },
		group: ['trigger'],
		version: 1,
		description: 'Starts a workflow when Uptimeify raises or resolves an alert',
		defaults: { name: 'Uptimeify Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'uptimeifyApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
				rawBody: true,
			},
		],
		properties: [
			{
				displayName: 'Scope',
				name: 'scope',
				type: 'options',
				options: [
					{ name: 'Organization', value: 'organization' },
					{ name: 'Customer', value: 'customer' },
					{ name: 'Website', value: 'website' },
				],
				default: 'organization',
				description: 'Which monitors this webhook channel covers',
			},
			{
				displayName: 'Customer ID',
				name: 'customerId',
				type: 'number',
				default: 0,
				required: true,
				description: 'Numeric customer ID the channel is scoped to',
				displayOptions: { show: { scope: ['customer', 'website'] } },
			},
			{
				displayName: 'Website ID',
				name: 'websiteId',
				type: 'number',
				default: 0,
				required: true,
				description: 'Numeric website ID for a website-level override',
				displayOptions: { show: { scope: ['website'] } },
			},
			{
				displayName: 'Source Channel ID',
				name: 'sourceChannelId',
				type: 'number',
				default: 0,
				required: true,
				description: 'Parent channel a website-level override belongs to',
				displayOptions: { show: { scope: ['website'] } },
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{ name: 'Alert', value: 'alert' },
					{ name: 'Recovery', value: 'recovery' },
					{ name: 'Reminder', value: 'reminder' },
					{ name: 'Slow', value: 'slow' },
					{ name: 'Unstable', value: 'unstable' },
					{ name: 'Warning', value: 'warning' },
				],
				default: [],
				description: 'Which notification types start the workflow. Empty means all of them.',
			},
			{
				displayName: 'Verify Signature',
				name: 'verifySignature',
				type: 'boolean',
				default: true,
				description:
					'Whether to check the HMAC-SHA256 signature Uptimeify sends. Turn this off only behind a proxy that rewrites the request body.',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');

				const response = await uptimeifyApiRequest.call(
					this,
					'GET',
					'/api/notification-channels',
				);

				const match = (extractItems(response) as unknown as ChannelRow[]).find(
					(channel) => channel.config?.url === webhookUrl,
				);

				if (match === undefined) return false;

				webhookData.channelId = match.id;
				return true;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');
				const scope = this.getNodeParameter('scope') as string;
				const secret = createWebhookSecret();

				const body: IDataObject = {
					type: 'webhook',
					name: `n8n — ${this.getWorkflow().name ?? 'workflow'}`,
					category: 'direct',
					config: { url: webhookUrl, method: 'POST', secret, timeout: 30 },
				};

				if (scope === 'customer' || scope === 'website') {
					body.customerId = this.getNodeParameter('customerId') as number;
				}

				if (scope === 'website') {
					body.websiteId = this.getNodeParameter('websiteId') as number;
					body.sourceChannelId = this.getNodeParameter('sourceChannelId') as number;
				}

				const created = (await uptimeifyApiRequest.call(
					this,
					'POST',
					'/api/notification-channels',
					body,
				)) as { id?: number };

				if (created.id === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						'Uptimeify did not return a channel ID for the new webhook channel',
					);
				}

				webhookData.channelId = created.id;
				webhookData.secret = secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const channelId = webhookData.channelId;

				if (channelId === undefined) return true;

				await uptimeifyApiRequest.call(
					this,
					'DELETE',
					`/api/notification-channels/${String(channelId)}`,
				);

				delete webhookData.channelId;
				delete webhookData.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const headers = this.getHeaderData();
		const body = this.getBodyData();
		const verifySignature = this.getNodeParameter('verifySignature') as boolean;
		const events = this.getNodeParameter('events') as string[];

		if (verifySignature) {
			const webhookData = this.getWorkflowStaticData('node');
			const secret = webhookData.secret;
			const rawBody = this.getRequestObject().rawBody;

			if (typeof secret !== 'string') {
				throw new NodeOperationError(
					this.getNode(),
					'No signing secret is stored for this trigger. Deactivate and reactivate the workflow so the channel is recreated, or turn Verify Signature off.',
				);
			}

			if (rawBody === undefined) {
				throw new NodeOperationError(
					this.getNode(),
					'The raw request body is not available, so the signature cannot be checked. Turn Verify Signature off if a proxy in front of n8n rewrites the body.',
				);
			}

			if (!isValidSignature(rawBody, headers['x-webhook-signature'], secret)) {
				return { noWebhookResponse: true, webhookResponse: { status: 401 } };
			}
		}

		const type = (body as { type?: string }).type;

		if (events.length > 0 && (type === undefined || !events.includes(type))) {
			return { noWebhookResponse: false, workflowData: [[]] };
		}

		return {
			workflowData: [
				[
					{
						json: {
							...(body as IDataObject),
							_headers: {
								event: headers['x-webhook-event'],
								attempt: headers['x-webhook-attempt'],
								timestamp: headers['x-webhook-timestamp'],
							},
						},
					},
				],
			],
		};
	}
}
```

- [ ] **Step 6: Node-Metadaten schreiben**

`nodes/UptimeifyTrigger/UptimeifyTrigger.node.json`:

```json
{
	"node": "n8n-nodes-base.uptimeifyTrigger",
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
				"url": "https://uptimeify.io/docs/integrations/webhooks"
			}
		]
	}
}
```

- [ ] **Step 7: Bauen, linten, Tests**

Run: `npm run build && npm run lint && npm test`
Expected: Build erfolgreich, Lint sauber, alle Tests PASS.

- [ ] **Step 8: Commit**

```bash
git add nodes/UptimeifyTrigger test/signature.test.ts
git commit -m "feat: add the Uptimeify trigger node

Registers itself as a webhook notification channel on activation, verifies the
HMAC-SHA256 signature against the raw request body, and deletes the channel
again when the workflow is deactivated.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---
### Task 13: Node `Uptimeify Tools`

**Files:**
- Create: `nodes/UptimeifyTools/shared/mcp.ts`, `nodes/UptimeifyTools/UptimeifyTools.node.ts`, `nodes/UptimeifyTools/UptimeifyTools.node.json`
- Test: `test/mcp.test.ts`

**Interfaces:**
- Consumes: nichts aus den anderen Nodes — dieser Node ist eigenständig und braucht keine Credentials
- Produces:
  - `MCP_ENDPOINT = 'https://uptimeify.io/mcp'`
  - `parseMcpBody(raw: unknown): IDataObject` — nimmt entweder ein JSON-Objekt oder einen Streamable-HTTP-Rumpf im `text/event-stream`-Format und liefert die JSON-RPC-Antwort
  - `readToolResult(rpc: IDataObject): { structured: IDataObject; isError: boolean; text: string }`
  - `TOOL_DEFINITIONS: Array<{ value: string; name: string; description: string; args: Array<{ name: string; displayName: string; type: 'string' | 'number'; required: boolean; placeholder: string }> }>`

Der Endpunkt antwortet nur auf dem kanonischen Host. Auf einer Kunden-Custom-Domain wirft der
Handler `404`, bevor er irgendetwas anderes tut. Deshalb gibt es hier keine Base-URL-Option.

- [ ] **Step 1: Failing test schreiben**

`test/mcp.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseMcpBody, readToolResult } from '../nodes/UptimeifyTools/shared/mcp';

describe('parseMcpBody', () => {
	it('passes a plain JSON-RPC object through', () => {
		const rpc = { jsonrpc: '2.0', id: 1, result: { content: [] } };

		expect(parseMcpBody(rpc)).toEqual(rpc);
	});

	it('parses a JSON string', () => {
		expect(parseMcpBody('{"jsonrpc":"2.0","id":1,"result":{}}')).toEqual({
			jsonrpc: '2.0',
			id: 1,
			result: {},
		});
	});

	it('reads the last data frame of an event stream', () => {
		const stream = [
			'event: message',
			'data: {"jsonrpc":"2.0","id":1,"result":{"isError":false}}',
			'',
		].join('\n');

		expect(parseMcpBody(stream)).toEqual({
			jsonrpc: '2.0',
			id: 1,
			result: { isError: false },
		});
	});

	it('throws on a body it cannot read', () => {
		expect(() => parseMcpBody('not json at all')).toThrow('Unreadable MCP response');
	});
});

describe('readToolResult', () => {
	it('prefers structured content', () => {
		const rpc = {
			result: {
				isError: false,
				content: [{ type: 'text', text: '{"ok":true}' }],
				structuredContent: { ok: true },
			},
		};

		expect(readToolResult(rpc)).toEqual({
			structured: { ok: true },
			isError: false,
			text: '{"ok":true}',
		});
	});

	it('falls back to the text block when there is no structured content', () => {
		const rpc = { result: { isError: true, content: [{ type: 'text', text: 'rate limited' }] } };

		expect(readToolResult(rpc)).toEqual({ structured: {}, isError: true, text: 'rate limited' });
	});

	it('surfaces a JSON-RPC level error as an error result', () => {
		const rpc = { error: { code: -32602, message: 'Invalid params' } };

		expect(readToolResult(rpc)).toEqual({ structured: {}, isError: true, text: 'Invalid params' });
	});
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run test/mcp.test.ts`
Expected: FAIL, `Failed to resolve import "../nodes/UptimeifyTools/shared/mcp"`.

- [ ] **Step 3: `mcp.ts` schreiben**

`nodes/UptimeifyTools/shared/mcp.ts`:

```ts
import type { IDataObject } from 'n8n-workflow';

/** `/mcp` answers only on the canonical host; a custom domain returns 404 before anything else. */
export const MCP_ENDPOINT = 'https://uptimeify.io/mcp';

type ToolArgument = {
	name: string;
	displayName: string;
	type: 'string' | 'number';
	required: boolean;
	placeholder: string;
};

export type ToolDefinition = {
	value: string;
	name: string;
	description: string;
	args: ToolArgument[];
};

const host = (required = true): ToolArgument => ({
	name: 'host',
	displayName: 'Host',
	type: 'string',
	required,
	placeholder: 'e.g. example.com',
});

const domain: ToolArgument = {
	name: 'domain',
	displayName: 'Domain',
	type: 'string',
	required: true,
	placeholder: 'e.g. example.com',
};

const url: ToolArgument = {
	name: 'url',
	displayName: 'URL',
	type: 'string',
	required: true,
	placeholder: 'e.g. https://example.com',
};

const ip: ToolArgument = {
	name: 'ip',
	displayName: 'IP Address',
	type: 'string',
	required: true,
	placeholder: 'e.g. 203.0.113.10',
};

const query: ToolArgument = {
	name: 'query',
	displayName: 'Query',
	type: 'string',
	required: true,
	placeholder: 'e.g. 203.0.113.10',
};

const port = (required: boolean): ToolArgument => ({
	name: 'port',
	displayName: 'Port',
	type: 'number',
	required,
	placeholder: 'e.g. 443',
});

export const TOOL_DEFINITIONS: ToolDefinition[] = [
	{ value: 'asn_lookup', name: 'ASN Lookup', description: 'Look up an autonomous system', args: [query] },
	{ value: 'check_dns', name: 'Check DNS', description: 'Resolve a domain', args: [domain] },
	{
		value: 'check_ssl',
		name: 'Check SSL',
		description: 'Inspect a TLS certificate',
		args: [host(), port(false)],
	},
	{
		value: 'dkim_check',
		name: 'DKIM Check',
		description: 'Check a DKIM record',
		args: [
			domain,
			{
				name: 'selector',
				displayName: 'Selector',
				type: 'string',
				required: true,
				placeholder: 'e.g. default',
			},
		],
	},
	{ value: 'dmarc_check', name: 'DMARC Check', description: 'Check a DMARC record', args: [domain] },
	{ value: 'dns_propagation', name: 'DNS Propagation', description: 'Check DNS propagation', args: [domain] },
	{ value: 'dnsbl_check', name: 'DNSBL Check', description: 'Check an IP against blocklists', args: [ip] },
	{ value: 'domain_expiry', name: 'Domain Expiry', description: 'Check when a domain expires', args: [domain] },
	{ value: 'hsts_check', name: 'HSTS Check', description: 'Check the HSTS policy', args: [domain] },
	{ value: 'http_headers', name: 'HTTP Headers', description: 'Read the response headers', args: [url] },
	{ value: 'ip_geolocation', name: 'IP Geolocation', description: 'Locate an IP address', args: [query] },
	{ value: 'mx_lookup', name: 'MX Lookup', description: 'Look up mail exchangers', args: [domain] },
	{
		value: 'ping_test',
		name: 'Ping Test',
		description: 'Ping a host',
		args: [host(), port(false)],
	},
	{
		value: 'port_check',
		name: 'Port Check',
		description: 'Check whether a port answers',
		args: [host(), port(true)],
	},
	{ value: 'redirect_check', name: 'Redirect Check', description: 'Follow a redirect chain', args: [url] },
	{ value: 'response_time', name: 'Response Time', description: 'Measure the response time', args: [url] },
	{ value: 'reverse_dns', name: 'Reverse DNS', description: 'Resolve an IP to a hostname', args: [ip] },
	{ value: 'spf_check', name: 'SPF Check', description: 'Check an SPF record', args: [domain] },
	{ value: 'website_status', name: 'Website Status', description: 'Check whether a site is up', args: [url] },
	{ value: 'whois', name: 'WHOIS', description: 'Look up WHOIS data', args: [domain] },
];

/**
 * The endpoint speaks streamable HTTP, so a successful call answers either with a JSON object or
 * with an event stream whose last `data:` frame carries the JSON-RPC response.
 */
export function parseMcpBody(raw: unknown): IDataObject {
	if (typeof raw === 'object' && raw !== null) return raw as IDataObject;

	if (typeof raw === 'string') {
		const trimmed = raw.trim();

		if (trimmed.startsWith('{')) {
			return JSON.parse(trimmed) as IDataObject;
		}

		const frames = trimmed
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice('data:'.length).trim());

		const last = frames[frames.length - 1];
		if (last !== undefined) return JSON.parse(last) as IDataObject;
	}

	throw new Error('Unreadable MCP response');
}

export function readToolResult(rpc: IDataObject): {
	structured: IDataObject;
	isError: boolean;
	text: string;
} {
	const rpcError = rpc.error as { message?: string } | undefined;

	if (rpcError !== undefined) {
		return { structured: {}, isError: true, text: rpcError.message ?? 'MCP request failed' };
	}

	const result = (rpc.result ?? {}) as {
		isError?: boolean;
		content?: Array<{ type?: string; text?: string }>;
		structuredContent?: IDataObject;
	};

	const text = result.content?.find((block) => block.type === 'text')?.text ?? '';

	return {
		structured: result.structuredContent ?? {},
		isError: result.isError === true,
		text,
	};
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run test/mcp.test.ts`
Expected: 7 Tests PASS.

- [ ] **Step 5: Tools-Node schreiben**

`nodes/UptimeifyTools/UptimeifyTools.node.ts`:

```ts
import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { MCP_ENDPOINT, parseMcpBody, readToolResult, TOOL_DEFINITIONS } from './shared/mcp';

function buildArgumentProperties(): INodeProperties[] {
	const properties: INodeProperties[] = [];

	for (const tool of TOOL_DEFINITIONS) {
		for (const argument of tool.args) {
			properties.push({
				displayName: argument.displayName,
				name: `${tool.value}_${argument.name}`,
				type: argument.type,
				default: argument.type === 'number' ? 0 : '',
				required: argument.required,
				placeholder: argument.placeholder,
				displayOptions: { show: { operation: [tool.value] } },
			});
		}
	}

	return properties;
}

export class UptimeifyTools implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Uptimeify Tools',
		name: 'uptimeifyTools',
		icon: { light: 'file:../../icons/uptimeify.svg', dark: 'file:../../icons/uptimeify.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Run Uptimeify public network checks. No account and no credentials needed.',
		defaults: { name: 'Uptimeify Tools' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: TOOL_DEFINITIONS.map((tool) => ({
					name: tool.name,
					value: tool.value,
					description: tool.description,
					action: tool.description,
				})),
				default: 'website_status',
			},
			...buildArgumentProperties(),
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const tool = TOOL_DEFINITIONS.find((entry) => entry.value === operation);

				if (tool === undefined) {
					throw new NodeOperationError(this.getNode(), `Unknown tool "${operation}"`, {
						itemIndex: i,
					});
				}

				const args: IDataObject = {};

				for (const argument of tool.args) {
					const value = this.getNodeParameter(`${tool.value}_${argument.name}`, i) as
						| string
						| number;

					if (value === '' || value === 0) {
						if (argument.required) {
							throw new NodeOperationError(
								this.getNode(),
								`"${argument.displayName}" is required for ${tool.name}`,
								{ itemIndex: i },
							);
						}

						continue;
					}

					args[argument.name] = value;
				}

				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: MCP_ENDPOINT,
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json, text/event-stream',
					},
					body: {
						jsonrpc: '2.0',
						id: i + 1,
						method: 'tools/call',
						params: { name: tool.value, arguments: args },
					},
					json: true,
					returnFullResponse: true,
				});

				const parsed = parseMcpBody((response as { body: unknown }).body);
				const result = readToolResult(parsed);

				if (result.isError) {
					throw new NodeOperationError(this.getNode(), result.text, { itemIndex: i });
				}

				returnData.push({
					json: Object.keys(result.structured).length > 0 ? result.structured : { text: result.text },
					pairedItem: { item: i },
				});
			} catch (error) {
				const statusCode = (error as { httpCode?: string; statusCode?: number }).statusCode;

				if (statusCode === 429) {
					const retryAfter = (error as { response?: { body?: { retryAfter?: number } } }).response
						?.body?.retryAfter;

					const hint =
						retryAfter === undefined
							? 'The rate limit was reached. The limits are 120 requests per minute overall and 15 to 30 per minute per tool, counted per IP.'
							: `The rate limit was reached. Retry in ${retryAfter} seconds.`;

					if (!this.continueOnFail()) {
						throw new NodeApiError(this.getNode(), error as never, { description: hint });
					}

					returnData.push({ json: { error: hint }, pairedItem: { item: i } });
					continue;
				}

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

- [ ] **Step 6: Node-Metadaten schreiben**

`nodes/UptimeifyTools/UptimeifyTools.node.json`:

```json
{
	"node": "n8n-nodes-base.uptimeifyTools",
	"nodeVersion": "1.0",
	"codexVersion": "1.0",
	"categories": ["Development", "Developer Tools", "Utility"],
	"resources": {
		"primaryDocumentation": [
			{
				"url": "https://uptimeify.io/docs/api/mcp"
			}
		]
	}
}
```

- [ ] **Step 7: Bauen, linten, Tests**

Run: `npm run build && npm run lint && npm test`
Expected: Build erfolgreich, Lint sauber, alle Tests PASS.

- [ ] **Step 8: Commit**

```bash
git add nodes/UptimeifyTools test/mcp.test.ts
git commit -m "feat: add the Uptimeify tools node for the 20 public checks

Calls the documented MCP endpoint over JSON-RPC and returns structuredContent.
The endpoint speaks streamable HTTP, so an event-stream body is read as well. A
429 answer carries retryAfter into the message so a workflow can wait it out.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---
### Task 14: README, CHANGELOG, LICENSE

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `LICENSE`

**Interfaces:**
- Consumes: die fertigen Nodes aus Task 6 bis 13
- Produces: die Dokumentation, auf die `Uptimeify.node.json` und
  `UptimeifyTrigger.node.json` mit `credentialDocumentation` verweisen (Anker `#credentials`)

- [ ] **Step 1: README schreiben**

`README.md` mit dieser Gliederung. Der Anker `#credentials` muss existieren, sonst zeigt der
Link in den `.node.json`-Dateien ins Leere.

```markdown
# n8n-nodes-uptimeify

n8n community nodes for [Uptimeify](https://uptimeify.io), an EU-hosted white-label monitoring
platform for agencies and MSPs.

This package adds three nodes:

- **Uptimeify** — manage websites, service monitors, customers, incidents, status pages,
  maintenance windows, notification channels, tags, and Incident Management.
- **Uptimeify Trigger** — start a workflow when Uptimeify raises or resolves an alert.
- **Uptimeify Tools** — run the 20 public network checks. No account needed.

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and install `@haupt-pascal/n8n-nodes-uptimeify`.

## Credentials

The Uptimeify and Uptimeify Trigger nodes need an API token. Create one in Uptimeify under
**Settings > API tokens**:

- Leave the customer field **empty** for an organization-wide token. It sees every customer and
  is the only kind Incident Management accepts.
- Pick a customer to scope the token to that customer.

The token is shown once, on creation. Set **Base URL** only if you reach Uptimeify under your own
white-label domain; it defaults to `https://uptimeify.io`.

The Uptimeify Tools node needs no credentials.

## Operations

(Table: resource, operations, notes. One row per resource, taken from the node.)

## Uptimeify Trigger

On activation the node creates a webhook notification channel in Uptimeify pointing at its own
webhook URL, with a generated signing secret. On deactivation it deletes that channel again.

Every request is verified against the `X-Webhook-Signature` header (HMAC-SHA256 over the raw
body). A request that does not verify is answered with 401 and does not start the workflow. Turn
**Verify Signature** off only if a proxy in front of n8n rewrites the request body.

Scope the channel to the whole organization, to one customer, or to a single website. A
website-level override additionally needs the parent channel's ID.

## Uptimeify Tools

Rate limits are counted per IP: 120 requests per minute across the endpoint, and 15 to 30 per
minute per tool (`whois` and `domain_expiry` are the strictest). A 429 answer carries the number
of seconds until the window resets into the error message.

## Notes

- `Status Page: Create` answers with `{ statusPage, dns }`, so the new page is at
  `$json.statusPage`.
- Incident Management operations need an organization-wide token **and** Incident Management
  enabled for the organization. Otherwise the API answers 403 and the node explains which of the
  two is missing.
- `Website: Get Check History` and the monitor history operations cap out at 200 entries. There
  is no pagination on those endpoints.

## Example workflows

(Two short examples: alert to Slack via the trigger, and a nightly certificate check with the
tools node.)

## License

[MIT](LICENSE)
```

- [ ] **Step 2: CHANGELOG schreiben**

`CHANGELOG.md`:

```markdown
# Changelog

## 0.1.0

First release.

- **Uptimeify** node with the resources Customer, Customer Domain, Customer IP, Incident,
  Incident Management: Incident, Incident Management: On-Call, Maintenance Window, Monitor,
  Notification Channel, Status Page, Tag, and Website.
- **Uptimeify Trigger** node. Registers and removes its own webhook notification channel and
  verifies the HMAC-SHA256 signature of every request.
- **Uptimeify Tools** node with the 20 public check tools of the Uptimeify MCP endpoint. Needs no
  credentials.
```

- [ ] **Step 3: LICENSE schreiben**

`LICENSE` mit dem MIT-Text, Copyright `2026 Pascal Haupt`.

- [ ] **Step 4: Anker prüfen**

Run: `grep -n '^## Credentials' README.md`
Expected: eine Trefferzeile. Ohne sie zeigt `credentialDocumentation` ins Leere.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md LICENSE
git commit -m "docs: document the three nodes, credentials and rate limits

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---

### Task 15: Cloud-Eignung, Gesamtprüfung, manueller Durchlauf

Diese Aufgabe ist das Qualitätstor vor der Veröffentlichung. Sie erzeugt keinen neuen Code,
sondern belegt, dass das Paket den Regeln entspricht und in n8n tatsächlich funktioniert.

**Files:**
- Modify: möglicherweise `eslint.config.mjs` (nur zurücksetzen, nie erweitern)

**Interfaces:**
- Consumes: das vollständige Paket aus Task 1 bis 14
- Produces: ein Paket, das `n8n-node lint` im Strict-Modus besteht und manuell verifiziert ist

- [ ] **Step 1: Cloud-Unterstützung aktivieren**

Run: `npx n8n-node cloud-support enable`
Expected: Meldung, dass Strict-Modus und Standard-ESLint-Konfiguration aktiv sind.

Run: `npx n8n-node cloud-support`
Expected: Status meldet Cloud-Eignung als aktiv.

- [ ] **Step 2: Gesamtprüfung**

Run: `npm run lint && npm run build && npm test`
Expected: Lint ohne Fehler **und ohne Warnungen**, Build erfolgreich, alle Tests PASS.

Warnungen werden behoben, nicht unterdrückt. Eine Ausnahme braucht einen Kommentar in derselben
Zeile, der begründet, warum die Regel hier nicht greift.

- [ ] **Step 3: Keine Runtime-Dependencies belegen**

Run: `node -e "const p=require('./package.json'); console.log(JSON.stringify(p.dependencies ?? null))"`
Expected: `null`.

- [ ] **Step 4: Sicherheitsdurchsicht**

Prüfen und je Punkt bestätigen:

- Jedes Feld, das ein Geheimnis trägt, hat `typeOptions: { password: true }`: Credential
  `apiToken`, SMTP `pass`, SSH `password` und `privateKey`, FTP `password`, IMAP/POP `password`,
  Website `authorizationHeader` und `basicAuthPassword`.
- Kein `console.log` im ausgelieferten Code: `grep -rn "console\." nodes credentials` liefert
  nichts.
- Keine hartkodierten Zugangsdaten: `grep -rn "wsm_" nodes credentials` liefert nur
  Platzhaltertexte in `placeholder`-Feldern.
- Das Trigger-Secret steht ausschließlich in `staticData` und im Uptimeify-Channel, nie in einer
  Ausgabe des Nodes.

- [ ] **Step 5: Manueller Durchlauf in n8n**

Run: `npm run dev`

n8n startet auf `http://localhost:5678`. Dort mit einem echten Token durchspielen und je Punkt
abhaken:

1. Credential anlegen, **Test** drücken — grün.
2. `Uptimeify` → Website → Get Many, *Return All* aus, Limit 5 — fünf Einträge.
3. `Uptimeify` → Monitor → Monitor Type ICMP → Get Many — Liste erscheint, der Resource Locator
   füllt sich.
4. `Uptimeify` → Website → Create → Trigger Check → Delete — der Kreis schließt sich.
5. `Uptimeify Trigger` aktivieren. In Uptimeify unter den Notification Channels erscheint ein
   Kanal namens `n8n — <Workflow>`. Einen echten Alarm auslösen (Monitor auf eine nicht
   erreichbare Adresse zeigen lassen), der Workflow läuft, die Signatur verifiziert.
6. Workflow deaktivieren — der Kanal ist in Uptimeify wieder weg.
7. `Uptimeify Tools` → Check SSL für `uptimeify.io` — Zertifikatsdaten kommen zurück.
8. `Uptimeify Tools` → WHOIS mehrfach hintereinander bis zum 429 — die Fehlermeldung nennt die
   Wartezeit.

**Vorbedingung, vor Beginn zu klären:** Läuft dieser Durchlauf gegen eine Sandbox-Organisation
oder gegen Produktion? Schritt 4 und 5 legen echte Monitore und Kanäle an und lösen echte Alarme
aus. Ohne diese Antwort nicht anfangen.

- [ ] **Step 6: Commit**

Nur committen, falls Schritt 1 oder 2 Dateien verändert hat.

```bash
git add -A
git commit -m "chore: enable n8n cloud support and clear all lint warnings

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---

### Task 16: Veröffentlichung und Einreichung

**Files:**
- Modify: `.github/workflows/publish.yml` (nur falls die vorhandene Fassung keine Provenance erzeugt)

**Interfaces:**
- Consumes: das geprüfte Paket aus Task 15
- Produces: `@haupt-pascal/n8n-nodes-uptimeify@0.1.0` auf npm, mit Provenance, und eine
  Einreichung im n8n Creator Portal

- [ ] **Step 1: Publish-Workflow prüfen**

`.github/workflows/publish.yml` öffnen und sicherstellen:

- Der Job hat `permissions: { id-token: write, contents: read }` — ohne `id-token` gibt es keine
  Provenance.
- `npm publish` läuft mit `--provenance --access public`.
- Kein langlebiges npm-Token in den Secrets nötig; npm Trusted Publisher ist eingerichtet.

Ab dem 01.05.2026 müssen verifizierte Nodes über GitHub Actions mit Provenance veröffentlicht
werden. `@n8n/node-cli` muss mindestens 0.23.0 sein:

Run: `node -e "console.log(require('./node_modules/@n8n/node-cli/package.json').version)"`
Expected: eine Version größer oder gleich `0.23.0`.

- [ ] **Step 2: npm Trusted Publisher einrichten**

Auf npmjs.com für das Paket `@haupt-pascal/n8n-nodes-uptimeify` unter *Trusted publishers* das
GitHub-Repository und den Workflow `publish.yml` hinterlegen. Das ist ein manueller Schritt im
Browser und lässt sich nicht aus dem Repository heraus erledigen.

- [ ] **Step 3: Repository auf GitHub anlegen und pushen**

```bash
gh repo create haupt-pascal/n8n-nodes-uptimeify --public --source=. --remote=origin --push
```

- [ ] **Step 4: Version taggen und veröffentlichen lassen**

```bash
git tag v0.1.0
git push origin v0.1.0
```

Anschließend den Workflow-Lauf beobachten:

Run: `gh run watch`
Expected: der Publish-Job wird grün.

Run: `npm view @haupt-pascal/n8n-nodes-uptimeify version`
Expected: `0.1.0`.

- [ ] **Step 5: Installation aus npm gegenprüfen**

In einer frischen n8n-Instanz das Paket über *Settings > Community nodes* installieren und einen
Node öffnen. Erscheinen die drei Nodes mit Icon und lässt sich das Credential anlegen, ist das
Paket auslieferbar.

- [ ] **Step 6: Einreichen**

Im [n8n Creator Portal](https://creators.n8n.io/nodes) das Paket einreichen. Bereitzuhalten:

- npm-Paketname und Version
- Repository-URL
- kurze Beschreibung, was die Nodes tun
- der Nachweis, dass keine Runtime-Dependencies enthalten sind (Task 15, Schritt 3)

- [ ] **Step 7: Commit**

Nur falls Schritt 1 den Workflow verändert hat.

```bash
git add .github/workflows/publish.yml
git commit -m "ci: publish with npm provenance from GitHub Actions

Verified community nodes have to be published this way from 2026-05-01.

Claude-Session: https://claude.ai/code/session_01K46SskZa8g9MQyeeNRCHUQ"
```

---

## Was dieser Plan nicht abdeckt

Bewusst außen vor, in der Spec begründet: Billing, Users, Whitelabel und Branding, Reports,
API-Token-Verwaltung, Custom Fields, Change Requests, Organization SMTP, Data Exports, Package
Configs, Monitoring Locations. Ebenfalls offen und im Uptimeify-Repository zu erledigen: der
Header `X-Webhook-Event` fehlt in der Webhook-Dokumentation (EN und DE in derselben Änderung).
