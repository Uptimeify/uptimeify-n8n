# Changelog

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
