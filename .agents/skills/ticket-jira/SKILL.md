---
name: ticket-jira
description: Investigate Jira support tickets by correlating logs, production data, and the code running at the time of the incident
---
 First of all, give to the name of chat the name of ticket jira (example PRTSUP-{number-ticket})


You have access to:

- Jira MCP → read the ticket and extract the affected user, timestamps, symptoms, and relevant context.
- Grafana MCP → inspect logs for the affected user and incident time window.
- MongoDB MCP → inspect the user's production database state when logs are incomplete or ambiguous. Only read-only queries are permitted.
- Legacy MySQL MCPs (`mysql-kippy-EU-akerue` = EU `admin_db`, `mysql-kippy-EU-kippy` = EU `kippy` subs, `mysql-kippy-EU-customerkippy` = EU `customerkippy` old CCT tickets, `mysql-petlink-USA` = all US schemas) → inspect the **pre-migration** state of migrated users/devices/subs: who the user was, which devices/subs/orders they had, whether the device was connecting on the old env. Read-only. DB map + join keys + per-scenario query recipes: `all-repo/old-env/AGENTS.md` §4 and `all-repo/old-env/docs/mysql-tables.md`. Most support tickets involve migrated data → checking the old-DB state is usually the fastest way to explain anomalies.
- Codebase of new environment (all-repo/new-env) → trace logs and observed behaviour back to the implementation (explore also fe/app mobile code if needed).
- Codebase of old environment (all-repo/old-env) → generally useless but when bugs are related to mix between portion of logic happend on old and new env, look also to the old environment codebas (start from all-repo/old-env/AGENTS.md to have an overview of old infrastrucutre)

Always correlate evidence across these sources. For all MCP jira ticket of support are related to prod environment so use MCP-prod.

## Investigation rules

When inspecting code, do not assume that the current branch reflects what was running in production at the time of the incident.

Use Git history to inspect the version of the code that was present on the production branch at the incident date and time.

Prefer evidence over assumptions. Clearly distinguish:

- Confirmed facts
- Reasonable inferences
- Missing or unavailable information

Report the most likely root cause and support it with evidence from Jira, logs, database state, and code.

## Response format

Always respond in Italian.

Structure the response in this order:

### 1. High level explanation

Start with a short, non-technical explanation of:

- What happened
- Why it most likely happened
- The chronology of what happened, distinguishing what occurred on the OLD env vs the NEW env
- Whether it is a known bug or a new issue
- What the practical impact is
- What should be done next

Do not start with code, stack traces, database documents, or implementation details.

### 2. Technical Analysis

Only after the high-level explanation, provide a more detailed technical analysis, including:

- Relevant Jira information
- Relevant logs and timestamps
- Relevant MongoDB state
- Code paths, functions, and files involved
- The production code version inspected
- Evidence supporting the root cause
- Any uncertainty or missing evidence

Use precise references to files, functions, logs, timestamps, and database fields whenever available.

## Known bugs

Check whether the ticket matches one of the known bugs documented in the `bugs/` folder.

- If it matches a known bug, do not create a new bug file. Reference the existing bug file in the response.
- If it is a new issue, create a new file named `bug-{problem}.md`.

Each bug file must contain enough context to understand the issue later without reopening the entire investigation, including:

- Jira ticket number
- Affected user
- Incident date and time
- Observed behaviour
- Relevant logs
- Relevant database state
- Root cause
- Code files and functions involved
- Production code version or commit inspected
- Evidence and reasoning
- Proposed fix
- Any remaining uncertainty


## Forbidden actions unless explicitly requested

Never:

- Modify production database data
- Execute MongoDB or MySQL write operations
- Edit or comment on Jira tickets
- Modify anything in Grafana
- Modify application code