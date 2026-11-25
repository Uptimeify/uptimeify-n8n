# Changelog

## 0.3.1

Maintenance release that brings the node back in line with the current Uptimeify API.

### Fixed

- **Customer: Bulk** sent the IDs as `customerIds`; the API requires `ids`, so every call failed.
- **Customer: Bulk Action** is now a list of the five actions the API has (Activate, Deactivate,
  Delete, Set Monthly Reports, Set Package) instead of free text, and sends the payload the last
  two require (**Monthly Reports Enabled**, **Package ID**).
- **Status Page: Create** sent the customer's UUID, but this endpoint only takes the numeric ID.
  The node now looks the ID up first. Customer is optional: leave it empty for a page of the
  whole organization.
- **Incident Management: Schedule: Create Override** now sends the required **Type**
  (Online/Offline). Without it every call failed.
- **Status Page: Get Many** returned nothing because the list arrives as `{ statusPages }`. The
  node now requests the `items` envelope.
- **Customer IP** and **Customer Domain** offered the status `inactive`; the API only knows
  `active` and `disabled`. The option is now **Disabled**. Workflows that had Inactive selected
  need the field set again.
- **Maintenance Window: Get Many** paged a list the API returns whole, which never ended with
  Return All and 200 or more windows.

### Added

- Schedule override: **Apply Scope** and **Covered By User IDs**.
- **Expected State** (Up/Down) on TCP monitors (under TCP Options) and on websites, where it
  applies to heartbeat monitors.
- Maintenance window target type **TCP**.
- Status page visibility **Password Protected** and **SSO Members Only**, plus **Access
  Password**.
- Error descriptions for `invalidRequestBody` (lists the rejected fields), `expectedStateNotSupported`,
  `targetHostMonitorLimitReached`, `targetHostPlatformLimitReached` and `monitorAlreadyExists`.

### Removed

Fields the API does not accept and silently dropped:

- **Escalation Policy ID** on Incident Management incident create.
- **IP Family** on Customer IP update (create keeps it).
- **Custom Domain Hostname** on Status Page update (create keeps it).
- **Priority** on Notification Channel create and update.
- **Domain Name** on Customer Domain update.

## 0.3.0

n8n's manual review of 0.2.1 requires exactly one regular node plus the trigger node per package.
This release removes the second regular node to comply.

### Breaking

- The **Uptimeify Tools** node is removed. Its 20 tools are now the **Network Diagnostics**
  resource of the main **Uptimeify** node.
- Using them now requires an Uptimeify credential to be configured on the node, the same as every
  other resource. The requests themselves are unchanged and remain unauthenticated — they are
  sent directly to `uptimeify.io`, ignoring the credential's Base URL.

## 0.2.1

n8n's automated verification scan rejected 0.2.0 over 7 `node-param-default-missing` lint
errors in the Tools node's shared MCP helper. The scanner runs its own ESLint config and ignores
inline `eslint-disable` comments, so the existing suppression didn't help.

### Fixed

- The internal tool-argument descriptors in `UptimeifyTools/shared/mcp.ts` were renamed
  (`name`/`displayName`/`type` -> `key`/`label`/`kind`) so they no longer structurally match n8n's
  node-parameter shape and trip the rule. No user-visible behavior changed.

## 0.2.0

Consistency and robustness pass. **This release renames parameters and splits a resource.**
Workflows built against 0.1.0 need to be reopened and their affected fields set again — two of
the renames fail silently rather than erroring, so check them specifically.

### Breaking

- The create and update field collections are now named **Additional Fields** and **Update
  Fields** everywhere. Customer Domain, Customer IP and Status Page previously shared one
  collection for both operations; Monitor called its collection Common Fields. **A create
  operation that used the old collection now silently ignores those values** — the request goes
  out without them and reports success. Update operations fail loudly instead.
- **Incident: Get Many**'s Source dropdown moved into a Filters collection. An existing workflow
  pinned to `manual` silently returns every source again.
- The **Incident Management: On-Call** resource is now three resources — **On-Call**, **Team**
  and **Schedule** — so each names a single entity. Its old operations no longer resolve.
- The **Uptimeify Trigger**'s Customer, Website and Source Channel fields are resource-locator
  pickers instead of typed numbers. Stored plain numbers are not read back.

### Added

- Return All and Limit on the On-Call, Team and Schedule list operations, which were the only
  list operations without them.
- Searchable pickers in the trigger for Customer, Website and Source Channel, so identifiers no
  longer have to be looked up by hand.
- The 200-entry cap on the check, alert and incident history operations is now stated on the
  Return All and Limit fields themselves, not only in the README.

### Fixed

- A trigger scope picker given a non-numeric value (a pasted UUID, for instance) produced a null
  scope, which could widen a customer-scoped webhook channel to the whole organization. Such
  input is now rejected before the channel is created.
- Required identifier fields defaulted to `1`, so an untouched field acted on record 1 — a
  forgotten Incident ID resolved incident 1 and reported success. They default to an invalid `0`
  again and fail instead.
- ID lists accepted JavaScript numeric syntax, so `1e3` and `0x10` were read as 1000 and 16.
  Only plain decimal digits are accepted now.
- A Base URL credential that is blank, whitespace, or not an http(s) URL now names the credential
  instead of failing later with a bare `Invalid URL`.
- The Monitor Port option no longer defaults to 6379, which silently repointed IMAP/POP monitors
  at Redis's port.
- Node subtitles show human-readable names rather than internal values such as `getAll: imSchedule`.

### Internal

- CI now runs the test suite, and both workflows moved off the deprecated Node 20 action runtime.

## 0.1.0

First release.

- **Uptimeify** node with the resources Customer, Customer Domain, Customer IP, Incident,
  Incident Management: Incident, Incident Management: On-Call, Maintenance Window, Monitor,
  Notification Channel, Status Page, Tag, and Website.
- **Uptimeify Trigger** node. Registers and removes its own webhook notification channel and
  verifies the HMAC-SHA256 signature of every request.
- **Uptimeify Tools** node with the 20 public check tools of the Uptimeify MCP endpoint. Needs no
  credentials.
