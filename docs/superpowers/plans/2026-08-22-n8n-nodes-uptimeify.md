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
