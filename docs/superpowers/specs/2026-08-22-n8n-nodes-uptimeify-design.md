# n8n Community Node Package für Uptimeify — Design

**Datum:** 2026-08-22
**Paket:** `@haupt-pascal/n8n-nodes-uptimeify`
**Ziel:** Drei Nodes, veröffentlicht auf npm, eingereicht zur Verifizierung im n8n Creator Portal.

## Kontext

Uptimeify ist eine White-Label-Monitoring-Plattform (EU-gehostet) für Agenturen und MSPs.
Die REST-API unter `https://uptimeify.io/api` umfasst rund 250 Endpunkte; dazu kommt ein
MCP-Server unter `POST /mcp` mit 20 anonymen Diagnose-Tools.

Quellen dieses Designs:

- `https://uptimeify.io/llms-full.txt` (vollständiger Doku-Export)
- Repository `~/dev/website-monitoring` — `monitoring-app/server/api/**`,
  `monitoring-workers/src/lib/delivery/adapters/webhook-family.ts`,
  `docs-site/content/docs/api/**`
- n8n: `https://docs.n8n.io/integrations/community-nodes/building-community-nodes.md`

Das Repository enthielt beim Start das `GithubIssues`-Boilerplate des `n8n-node`-Scaffolds.
Dieses wird vollständig ersetzt.

## Umfang

**Enthalten:** Action-Node mit Kern-Ressourcen plus Incident Management, Webhook-Trigger-Node,
Tools-Node für die anonymen MCP-Diagnose-Tools.

**Nicht enthalten (bewusst, spätere Version):** Billing, Users, Whitelabel/Branding, Reports,
API-Token-Verwaltung, Custom Fields, Change Requests, Organization SMTP, Data Exports,
Package Configs, Monitoring Locations.

## Architektur

```
n8n-nodes-uptimeify/
├── credentials/
│   └── UptimeifyApi.credentials.ts
├── icons/
│   ├── uptimeify.svg
│   └── uptimeify.dark.svg
└── nodes/
    ├── Uptimeify/
    │   ├── Uptimeify.node.ts
    │   ├── Uptimeify.node.json
    │   ├── shared/
    │   │   ├── transport.ts        # HTTP + Pagination
    │   │   ├── errors.ts           # data.code → NodeApiError
    │   │   ├── descriptions.ts     # geteilte INodeProperties
    │   │   └── types.ts            # API-Response-Interfaces
    │   ├── listSearch/
    │   │   ├── getCustomers.ts
    │   │   ├── getWebsites.ts
    │   │   ├── getMonitors.ts
    │   │   ├── getTags.ts
    │   │   └── getTeams.ts
    │   └── resources/
    │       ├── website/
    │       ├── monitor/
    │       ├── incident/
    │       ├── customer/
    │       ├── statusPage/
    │       ├── maintenanceWindow/
    │       ├── notificationChannel/
    │       ├── tag/
    │       ├── imIncident/
    │       └── imOnCall/
    ├── UptimeifyTrigger/
    │   ├── UptimeifyTrigger.node.ts
    │   ├── UptimeifyTrigger.node.json
    │   └── shared/signature.ts     # HMAC-SHA256-Verifikation
    └── UptimeifyTools/
        ├── UptimeifyTools.node.ts
        ├── UptimeifyTools.node.json
        └── shared/mcp.ts           # JSON-RPC-Transport
```

Die Icons werden aus `~/dev/website-monitoring/monitoring-app/public/img/uptimeify-icon.svg`
und `uptimeify-icon-dark.svg` übernommen.

### Warum drei Nodes

Die Credential-Pflicht gilt in n8n node-weit. Der Tools-Node soll ohne Konto nutzbar sein
(die MCP-Tools sind anonym), also bekommt er einen eigenen Node statt einer Ressource im
Action-Node mit ausgehebelter Credential-Pflicht.

### Warum programmatischer Stil

Deklarativ (`routing`) trägt diesen Node nicht, weil:

1. **Pagination.** Listen antworten mit `{ items, total, page, perPage }`; `returnAll` muss
   in einer Schleife bis zur Erschöpfung nachladen.
2. **Monitor-Multiplexing.** Eine Ressource *Monitor* mit einem Feld *Monitor Type* bildet
   neun Endpunkt-Präfixe ab (`/api/dns-monitors`, `/api/icmp-monitors`, `/api/tcp-monitors`,
   `/api/smtp-monitors`, `/api/ssh-monitors`, `/api/ftp-monitors`, `/api/imap_pop-monitors`,
   `/api/domain-monitors`, `/api/dnsbl-monitors`). Der Pfad hängt von einem Parameterwert ab.
3. **Trigger-Lifecycle.** Der Trigger legt beim Aktivieren einen Notification Channel an und
   löscht ihn beim Deaktivieren.
4. **MCP-Envelope.** Der Tools-Node packt Argumente in einen JSON-RPC-Body und packt
   `structuredContent` wieder aus.

## Credential `uptimeifyApi`

| Feld | Typ | Pflicht | Default |
|---|---|---|---|
| `apiToken` | string, `typeOptions: { password: true }` | ja | — |
| `baseUrl` | string | nein | `https://uptimeify.io` |

Authentifizierung über `IAuthenticateGeneric`:

```
headers: { Authorization: '=Bearer {{$credentials.apiToken}}' }
```

API-Tokens beginnen mit `wsm_`. Sie existieren in zwei Ausprägungen: organisationsweit
(sieht alle Kunden) und kundengebunden (sieht nur diesen Kunden). Beide gehen über denselben
Header; das Credential unterscheidet sie nicht.

`baseUrl` ist konfigurierbar, weil Uptimeify White-Label mit Kunden-eigenen Domains läuft.

**Credential-Test:** `GET {baseUrl}/api/websites?perPage=1`.

**Kein OAuth2-Credential.** Der OAuth-/Agentic-Pfad gibt ausschließlich read-only Tokens
(`wsma_`) aus; jeder Schreibzugriff scheitert mit `data.code: agentTokenReadOnly`. Für einen
Automatisierungs-Node ist das nutzlos.

`documentationUrl` zeigt auf `https://uptimeify.io/docs/api/introduction/generate-api-token`.

## Node 1: `Uptimeify`

- `displayName: 'Uptimeify'`, `name: 'uptimeify'`, `version: 1`, `group: ['input']`
- `usableAsTool: true`
- `subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}'`
- Credential `uptimeifyApi`, `required: true`

### Ressourcen und Operationen

| Ressource | Operationen | Endpunkte |
|---|---|---|
| Website | Create, Get, Get Many, Update, Delete, Trigger Check, Change Status, Get Check History, Get Uptime Stats | `/api/websites`, `/api/websites/:websitePublicId`, `…/check-history`, `…/uptime-stats` |
| Monitor | Create, Get, Get Many, Update, Delete, Trigger Check, Get Check History, Get Alert History, Get Incident History | `/api/{type}-monitors` (sieben Typen) |
| Customer Domain | Create, Get, Get Many, Update, Delete | `/api/customers/:id/domains`, `/api/customer-domains`, `/api/customer-domains/:id` |
| Customer IP | Create, Get, Get Many, Update, Delete | `/api/customers/:id/ips`, `/api/customer-ips`, `/api/customer-ips/:id` |
| Incident | Get, Get Many, Delete | `/api/incidents`, `/api/incidents/:id` |
| Customer | Create, Get, Get Many, Update, Bulk Action, Get SMS Usage | `/api/customers`, `/api/customers/:customerPublicId`, `/api/customers/bulk`, `/api/customers/sms-usage` |
| Status Page | Create, Get Many, Update, Delete | `/api/status-pages`, `/api/status-pages/:id` |
| Maintenance Window | Create, Get, Get Many, Update, Delete, Preview Occurrences | `/api/maintenance-windows`, `…/preview-occurrences` |
| Notification Channel | Create, Get Many, Update, Delete, Test | `/api/notification-channels`, `/api/notification-channels/:id` |
| Tag | Create, Get Many, Update, Delete, Assign to Monitor, Remove from Monitor | `/api/tags`, `/api/monitor-tags` |
| IM: Incident | Ingest Event, Create, Get, Get Many, Update Status, Resolve | `/api/im/events`, `/api/im/incidents`, `…/:id/status`, `…/:id/resolve` |
| IM: On-Call | Who Is On Call, Get Teams, Get Schedules, Create Schedule Override | `/api/im/on-call`, `/api/im/teams`, `/api/im/schedules`, `…/:id/overrides` |

Die Ressource *Monitor* trägt ein Pflichtfeld **Monitor Type** mit den Werten
`dns`, `icmp`, `tcp`, `smtp`, `ssh`, `ftp`, `imap-pop`. Der Wert bestimmt das Pfad-Präfix
(`/api/dns-monitors` … `/api/imap-pop-monitors`) und den Namen des Konfigurationsobjekts im
Request-Body (`dnsConfig`, `icmpConfig`, `config`, `smtpConfig`, `sshConfig`, `ftpConfig`,
`imapPopConfig`). Typ-spezifische Felder (`checkMode` für SMTP/SSH/FTP/IMAP-POP, `port`,
`dnsConfig.rrtypes`) erscheinen über `displayOptions` nur beim passenden Typ.

**Nachtrag aus der Umsetzung (Task 7):** `checkMode` ist beim Anlegen ein eigenes Feld, beim
Ändern liegt es in der Sammlung und wird nur mitgeschickt, wenn der Nutzer es bewusst setzt.
Sonst kippt jedes Update eines Monitors im TCP-Modus ihn still zurück auf `protocol`. Ob ein
Konfigurationsobjekt mitgeht, entscheidet die ausgefüllte Options-Sammlung, nicht die Anwesenheit
von `checkMode`; nur ein ausdrückliches `checkMode: tcp` unterdrückt es. Die DNS-Erwartungswerte
werden vor dem Request geprüft: doppelter RR-Type, leere Werteliste und ein ausgewählter RR-Type
ohne Zeile werfen einen `NodeOperationError` statt in einen rohen 400 zu laufen.

**Korrektur gegenüber der ersten Fassung dieser Spec:** Endpunkte `/api/domain-monitors` und
`/api/dnsbl-monitors` existieren nicht. Der Doku-Export `llms-full.txt` legt das nahe, das
Routen-Verzeichnis `monitoring-app/server/api/` kennt sie nicht. Domain-Expiry läuft über
*Customer Domains*, DNSBL über *Customer IPs* — beide sind oben als eigene Ressourcen
aufgenommen, damit die zugesagte Abdeckung erhalten bleibt. Ebenso heißt der Pfad
`/api/imap-pop-monitors` mit Bindestrich, nicht `/api/imap_pop-monitors`; der Unterstrich
kommt nur in `monitorType`-Werten von `/api/monitor-tags` vor.

### Resource Locator

Customer, Website, Monitor, Tag und Team bekommen einen `resourceLocator` mit den Modi
`fromList` (gefüllt über `listSearch`, mit Suche und Pagination) und `id` (manuelle Eingabe).
Damit muss niemand UUIDs abtippen.

### Incident Management: Vorbedingungen

IM-Endpunkte verlangen laut Doku einen **organisationsweiten** Token. Ein kundengebundener
Token liefert `403` mit `data.code: imAccessDenied`. Ist IM für die Organisation nicht
aktiviert, liefert jeder IM-Endpunkt `403` mit `data.code: imNotEnabled`. Beide Codes werden
in Klartext übersetzt (siehe Fehlerbehandlung).

## Node 2: `Uptimeify Trigger`

- `displayName: 'Uptimeify Trigger'`, `name: 'uptimeifyTrigger'`, `version: 1`, `group: ['trigger']`
- Credential `uptimeifyApi`, `required: true`
- `webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' }]`

### Lifecycle

`webhookMethods.default`:

- **`create`** — `POST /api/notification-channels`:

  ```json
  {
    "type": "webhook",
    "name": "n8n — <Workflow-Name>",
    "category": "direct",
    "config": {
      "url": "<n8n-Webhook-URL>",
      "method": "POST",
      "secret": "<im Node erzeugt, 32 Byte hex>",
      "timeout": 30
    },
    "customerId": <optional>,
    "websiteId": <optional, verlangt sourceChannelId>
  }
  ```

  Die zurückgegebene Channel-ID und das Secret landen in `staticData`.

- **`checkExists`** — `GET /api/notification-channels`, Treffer über `config.url` gleich der
  n8n-Webhook-URL.

- **`delete`** — `DELETE /api/notification-channels/:id` mit der ID aus `staticData`,
  danach `staticData` leeren.

### Signaturprüfung

Uptimeify signiert bei gesetztem `config.secret` die **exakten Bytes des Request-Bodys** mit
HMAC-SHA256 und sendet das Ergebnis hex-kodiert in `X-Webhook-Signature`, dazu
`X-Webhook-Signature-Algorithm: sha256`.

Der Node prüft gegen den rohen Body, vor jedem Parsen. Längenvergleich zuerst, dann
`crypto.timingSafeEqual`. Kein Treffer bedeutet HTTP 401 und keinen Workflow-Lauf.
Parameter *Verify Signature* (Boolean, Default `true`) kann die Prüfung abschalten, für
Setups hinter einem Proxy, der den Body umschreibt.

### Parameter

| Parameter | Typ | Beschreibung |
|---|---|---|
| Scope | options: `organization` / `customer` / `website` | Reichweite des Channels |
| Customer | resourceLocator | bei Scope `customer` oder `website` |
| Website | resourceLocator | bei Scope `website`; erfordert zusätzlich `sourceChannelId` |
| Source Channel ID | string | Elternkanal für Website-Overrides |
| Events | multiOptions: `alert`, `recovery`, `reminder`, `warning`, `unstable`, `slow` | Filter über `body.type`; leer = alle |
| Verify Signature | boolean, Default `true` | HMAC-Prüfung |

### Output

Der dokumentierte Webhook-Payload unverändert als JSON: `type`, `check_degraded`,
`incident_id`, `message`, `expected_response_error`, `ssl`, `website`, `customer`, `incident`
(mit `error_details.blocking_response` samt `counter_probe`).

Zusätzlich ein Feld `_headers` mit `X-Webhook-Event`, `X-Webhook-Attempt` und
`X-Webhook-Timestamp`.

**Doku-Lücke:** Der Worker sendet `X-Webhook-Event`
(`monitoring-workers/src/lib/delivery/adapters/webhook-family.ts`), die Header-Tabelle in
`docs-site/content/docs/integrations/webhooks.{en,de}.mdx` führt ihn nicht auf. Nachtragen —
eigene Aufgabe im Uptimeify-Repository, EN und DE in derselben Änderung, kein Blocker für
dieses Paket.

## Node 3: `Uptimeify Tools`

- `displayName: 'Uptimeify Tools'`, `name: 'uptimeifyTools'`, `version: 1`, `group: ['transform']`
- **Keine Credentials**
- `usableAsTool: true`
- **Keine Base-URL-Option.** `/mcp` antwortet nur auf dem kanonischen Host; auf einer
  Kunden-Custom-Domain wirft der Handler `404`, bevor er irgendetwas anderes tut
  (`monitoring-app/server/routes/mcp/index.post.ts`). Der Host ist fest
  `https://uptimeify.io`.

### Transport

Ein `POST https://uptimeify.io/mcp` je Ausführung, JSON-RPC 2.0:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": { "name": "<tool>", "arguments": { … } }
}
```

Header: `Content-Type: application/json`, `Accept: application/json, text/event-stream`.

Die Antwort wird auf `result.structuredContent` reduziert. Bei `result.isError === true`
wird der Textblock als `NodeApiError` geworfen.

### Operationen

Eine Operation je Tool, 20 insgesamt:

| Operation | Argumente |
|---|---|
| `check_ssl` | `host`, `port` (optional) |
| `check_dns` | `domain` |
| `dns_propagation` | `domain` |
| `mx_lookup` | `domain` |
| `spf_check` | `domain` |
| `dkim_check` | `domain`, `selector` |
| `dmarc_check` | `domain` |
| `dnsbl_check` | `ip` |
| `whois` | `domain` |
| `domain_expiry` | `domain` |
| `http_headers` | `url` |
| `hsts_check` | `domain` |
| `redirect_check` | `url` |
| `port_check` | `host`, `port` |
| `ping_test` | `host`, `port` (optional) |
| `website_status` | `url` |
| `response_time` | `url` |
| `ip_geolocation` | `query` |
| `asn_lookup` | `query` |
| `reverse_dns` | `ip` |

### Rate Limits

120 Anfragen/Minute je IP auf `/mcp` insgesamt, 15–30/Minute je Tool (`whois` und
`domain_expiry` am strengsten). Bei `429` liest der Node `retryAfter` (Sekunden) aus der
Antwort und nennt den Wert in der Fehlermeldung, damit ein Wait-Retry im Workflow möglich ist.

**Verworfene Alternative:** die REST-Endpunkte `/api/tools/*` (33 Stück, mehr als MCP) sind
öffentlich und ohne Auth erreichbar, stehen aber nicht in den veröffentlichten API-Docs. Ein
undokumentierter Vertrag in einem publizierten npm-Paket ist ein Wartungsrisiko; der
MCP-Endpunkt ist dokumentiert und liefert je Tool ein `outputSchema`.

## Querschnittsthemen

### Pagination

Listen-Operationen bekommen `returnAll` (boolean) und `limit` (number, sichtbar wenn
`returnAll === false`). Die API kennt drei Antwortformen, der Transport bedient alle drei:

1. **Seiten-Pagination** — `{ items, total, page, perPage }`, Parameter `page`/`perPage`
   (Maximum 200). Betrifft Websites, Monitore, Maintenance Windows, Customer Domains,
   Customer IPs.
2. **Offset-Pagination** — nacktes Array, Parameter `limit` (Maximum 500) und `offset`.
   Betrifft `/api/incidents`.
3. **Cursor-Pagination** — `{ items, nextCursor }`, Parameter `limit` (Maximum 100) und
   `cursor`. Betrifft `/api/im/incidents`. Der Cursor ist undurchsichtig und wird unverändert
   zurückgeschickt.
4. **Nacktes Array ohne Pagination** — `/api/customers`, `/api/tags`,
   `/api/notification-channels`, `/api/im/teams`, `/api/im/schedules`, `/api/im/on-call`.
   Hier greift `limit` erst nach dem Empfang.

Die Verlaufs-Endpunkte (`check-history`, `alert-history`, `incident-history`) antworten mit
`{ data: [...] }` statt `{ items: [...] }` und kennen nur `limit` (Maximum 200).

### Leere Query-Parameter

Optionale Query-Parameter werden **weggelassen**, nie als leerer String gesendet. Laut
`error-codes-and-known-pitfalls` macht Zod aus `organizationId=` eine `0`, was gegen
`min`-Constraints verstößt und `400` liefert.

### Fehlerbehandlung

`shared/errors.ts` liest `data.code` aus der Antwort und erzeugt einen `NodeApiError` mit
verständlicher Beschreibung:

| `data.code` | Meldung |
|---|---|
| `managed_by_organization` | Monitor wird von der Organisation verwaltet — Change Request statt direkter Änderung |
| `selfServiceNotAllowed` | Self-Service ist für diesen Kunden abgeschaltet |
| `selfServiceQuotaReached` | Self-Service-Kontingent des Kunden erschöpft |
| `managementTypeOrgOnly` | `managementType` darf nur ein Organisations-Admin ändern |
| `tooManyOpenRequests` | 10 offene Change Requests erreicht |
| `invalidPackageType` | `packageId` gehört nicht zu dieser Organisation |
| `portRequiredForTcp` | IMAP/POP im TCP-Modus braucht einen expliziten Port |
| `invalidCheckMode` | `checkMode` muss `protocol` oder `tcp` sein |
| `notManualIncident` | Nur manuell angelegte Incidents sind löschbar |
| `imAccessDenied` | Incident Management verlangt einen organisationsweiten Token |
| `imTeamWriteDenied` | Schreibrecht auf dieses Team fehlt |
| `imScheduleNotFound` | Schedule gehört nicht zu dieser Organisation |
| `payloadTooLarge` | Event-Payload über 256 KB |
| `payloadTooDeep` | Event-Payload tiefer als 20 Ebenen |
| `imNotEnabled` | Incident Management ist für diese Organisation nicht aktiviert |
| `invalidWindow` | `endTime` muss nach `startTime` liegen |

Unbekannte Codes werden durchgereicht. Alle Operationen unterstützen *Continue On Fail* und
setzen den Item-Index im Fehler.

### Typen

`shared/types.ts` trägt den Vertrag, dem jede Ressource folgt (`ResourceExecute`). Antwort-Typen
stehen dort, wo sie gelesen werden — als schmale Interfaces neben der Funktion, die genau diese
Felder braucht, nicht als vollständige Nachbildung der API. Kein `any`, keine
`@typescript-eslint`-Ausnahme ohne begründenden Kommentar in derselben Zeile.

### Abhängigkeiten

Keine Runtime-Dependencies. Verifizierte Nodes dürfen keine haben. Für HMAC wird `node:crypto`
verwendet.

## Tests

Kein Test-Framework im Scaffold. Wir bleiben bei dem, was das `n8n-node`-Tooling hergibt:

- `n8n-node lint` ohne Fehler und Warnungen
- `n8n-node build` erfolgreich
- Manueller Durchlauf über `n8n-node dev` gegen eine echte Organisation (siehe offener Punkt)

Reine Funktionen ohne Netzwerk — Signaturprüfung, Fehler-Mapper, Pagination-Schleife —
werden so geschnitten, dass sie später ohne Umbau testbar sind.

## Weg bis zur Einreichung

1. `GithubIssues`-Boilerplate entfernen (`nodes/GithubIssues/`, `credentials/GithubIssues*`,
   `icons/github*`). `package.json` anpassen: `n8n.nodes`, `n8n.credentials`, `description`,
   `keywords`, `repository`, `homepage`, `author`.
2. Credential, dann die drei Nodes implementieren.
3. `n8n-node cloud-support enable` (strict mode plus Default-ESLint-Konfiguration),
   `n8n-node lint` und `n8n-node build` grün.
4. `n8n-node dev` — manuell prüfen: Website anlegen, Monitor je Typ anlegen, Trigger
   aktivieren, echten Alarm auslösen, Channel-Löschung beim Deaktivieren bestätigen,
   drei Tools-Operationen ausführen.
5. README (Installation, Credential-Einrichtung, Ressourcen-/Operationstabelle,
   Beispiel-Workflows), `CHANGELOG.md` auf `0.1.0`, `LICENSE` (MIT).
6. Veröffentlichung über den vorhandenen `.github/workflows/publish.yml` mit npm Trusted
   Publisher. Provenance-Statements aus GitHub Actions sind ab 01.05.2026 Pflicht für
   verifizierte Nodes; `@n8n/node-cli` muss mindestens 0.23.0 sein.
7. Einreichen über das n8n Creator Portal (`https://creators.n8n.io/nodes`).

## Offener Punkt

Schritt 4 verlangt einen echten `wsm_`-Token und eine Organisation mit aktivem Incident
Management. Ob dafür eine Sandbox-Organisation existiert oder gegen Produktion getestet wird,
entscheidet Pascal vor Beginn der Umsetzung. Bis dahin gilt die Annahme: Test gegen eine
Sandbox-Organisation, damit angelegte Monitore und Webhook-Channels keine echten Kunden
betreffen.
