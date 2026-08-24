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
and install `@uptimeify/n8n-nodes-uptimeify`.

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

| Resource                      | Operations                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Customer                      | Create, Get, Get Many, Update, Bulk Action, Get SMS Usage                                                        |
| Customer Domain               | Create, Get, Get Many, Update, Delete                                                                            |
| Customer IP                   | Create, Get, Get Many, Update, Delete                                                                            |
| Incident                      | Get, Get Many, Delete                                                                                            |
| Incident Management: Incident | Ingest Event, Create, Get, Get Many, Update Status, Resolve                                                      |
| Incident Management: On-Call  | Get Many                                                                                                         |
| Incident Management: Schedule | Get Many, Create Override                                                                                        |
| Incident Management: Team     | Get Many                                                                                                         |
| Maintenance Window            | Create, Get, Get Many, Update, Delete, Preview Occurrences                                                       |
| Monitor                       | Create, Get, Get Many, Update, Delete, Trigger Check, Get Check History, Get Alert History, Get Incident History |
| Notification Channel          | Create, Get Many, Update, Delete, Test                                                                           |
| Status Page                   | Create, Get Many, Update, Delete                                                                                 |
| Tag                           | Create, Get Many, Update, Delete, Assign to Monitor, Remove From Monitor                                         |
| Website                       | Create, Get, Get Many, Update, Delete, Trigger Check, Change Status, Get Check History, Get Uptime Stats         |

The Monitor resource covers DNS, ICMP, TCP, SMTP, SSH, FTP and IMAP/POP through a single
**Monitor Type** field. Domain expiry monitoring lives under Customer Domain, DNSBL monitoring
under Customer IP.

Incident Management's on-call data is split across three resources so each one lists a single
entity: **On-Call** answers who is currently on call, **Team** lists the teams themselves, and
**Schedule** lists schedules and creates schedule overrides.

For SMTP, SSH, FTP and IMAP/POP monitors, **Check Mode** decides whether the monitor logs in with
credentials (`Protocol`) or only checks that the port answers (`TCP`, no credentials stored). On
**Create** it is a standalone field. On **Update** it instead sits inside the **Common Fields**
options collection and is only sent when you deliberately set it there — this keeps a routine edit
(renaming the monitor, changing its interval, …) from silently flipping it back to `Protocol`
mode. Likewise, whether a type-specific config object (e.g. **SMTP Options**) is sent on update
depends only on whether you filled in that type's options collection, not on whether Check Mode
was set.

## Uptimeify Trigger

On activation the node creates a webhook notification channel in Uptimeify pointing at its own
webhook URL, with a generated signing secret. On deactivation it deletes that channel again.

Every request is verified against the `X-Webhook-Signature` header (HMAC-SHA256 over the raw
body). A request that does not verify is answered with 401 and does not start the workflow. Turn
**Verify Signature** off only if a proxy in front of n8n rewrites the request body.

Scope the channel to the whole organization, to one customer, or to a single website. Customer,
Website and Source Channel (the parent channel a website-level override belongs to) are picked
through the same searchable-list-or-by-ID field the Uptimeify action node uses. The values are not
interchangeable with the action node's pickers, though: the channel endpoint the trigger calls
only accepts numeric IDs, so these pickers hand back the numeric ID rather than the public UUID
the action node's Customer and Website pickers use.

**Events** picks which notification types start the workflow: Alert, Recovery, Reminder, Slow,
Unstable and Warning. Leave it empty and every type starts the workflow; select some and anything
else is acknowledged without a run.

## Uptimeify Tools

Rate limits are counted per IP: 120 requests per minute across the endpoint, and 15 to 30 per
minute per tool (`whois` and `domain_expiry` are the strictest). When a 429 response tells the
node how many seconds remain until the window resets, the error message states that number;
otherwise it states the published limits above.

## Notes

- `Status Page: Create` answers with `{ statusPage, dns }`, so the new page is at
  `$json.statusPage`.
- Incident Management operations need an organization-wide token **and** Incident Management
  enabled for the organization. Otherwise the API answers 403 and the node explains which of the
  two is missing.
- `Website: Get Check History` and the monitor history operations cap out at 200 entries. There
  is no pagination on those endpoints.

## Example workflows

**Page the on-call engineer when a site goes down**

`Uptimeify Trigger` (Events: Alert) → `IF` (`{{ $json.incident.error_details.blocking_response }}`
is empty) → `Uptimeify` (Incident Management: Incident, Ingest Event, payload
`{{ JSON.stringify($json) }}`).

The `IF` step splits a real outage from a check that a firewall turned away. When
`blocking_response` is set, an edge rejected the check and the origin may be healthy.

**Check certificates every night**

`Schedule Trigger` (daily) → `Uptimeify` (Website, Get Many, Return All) → `Uptimeify Tools`
(Check SSL, Host `{{ $json.url.replace(/^https?:\/\//, '').split('/')[0] }}`) → `IF`
(days remaining below 21) → your notification of choice.

## License

[MIT](LICENSE)
