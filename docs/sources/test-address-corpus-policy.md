# Consented live test-address corpus: policy and status

**Status (2026-09-02): the corpus does not exist yet. This is a concrete blocker** for every live
resolver or provider test (ADR-002, ADR-004, PLA-363, PLA-376+). No live validation was performed
in Round 1 and none was fabricated. Linear: PLA-349.

## Why a corpus is needed

Synthetic fixtures prove code paths; they cannot prove that a resolver recognises a real unit or
that a provider's flow returns a particular outcome. Real addresses are sensitive, so the corpus
must be consented, encrypted, access-limited, and never present in Git, Linear, CI output,
screenshots, or normal logs.

## Required coverage (each case at least once)

single-family valid; MDU with a valid unit; MDU with the unit omitted; MDU with an invalid unit;
ambiguous address (multiple candidates); alias/directional/suffix variation of a covered address;
rural address; new construction (where obtainable); unsupported market (outside every launch
market); fixed-wireless coverage present; provider explicitly available; provider explicitly
unavailable; partial-failure case (one provider blocks or times out).

## Consent and ownership

- Each address is contributed by a person with authority over it (resident or owner) who signs a
  short consent recording: permitted providers to query, permitted environments (local, staging,
  production canary), start date, review date, and the right to withdraw at any time.
- Consent records live with the corpus, not in Git or Linear.
- The maintainer is the corpus owner and the only approver of additions.

## Storage and access

- Stored in a managed secret store (for local development: an encrypted file outside the
  repository, key held by the maintainer; for CI/staging: the platform's secret manager).
- Least privilege: only the live-canary runner and the maintainer can read it.
- Every read is logged with an opaque fixture ID, never the address.

## Reference by opaque ID

Code, tests, CI, logs, dashboards, and Linear refer to entries only as `corpus:<case>:<n>`
(for example `corpus:mdu-missing-unit:1`). The mapping from ID to address exists only inside the
secret store.

## Metadata (public, safe to commit)

For each ID: case type, market id (from the launch matrix), building type (SFH/MDU), whether a
unit is expected, providers permitted, consent review date. No street, ZIP+4, or coordinates.

## CI and artifacts

- Deterministic CI never has access to the corpus.
- Live canaries run only in a protected workflow with explicit secrets and
  `ISP_SEARCH_TEST_NETWORK=true`, never on untrusted PRs.
- CI output must not print resolved addresses or raw provider payloads; the logger's redaction is
  mandatory and the canary tests guard it.
- Screenshot/HAR/video capture is off by default; when explicitly enabled for debugging it is
  encrypted and deleted within 24 hours (ADR-007).

## Rotation, removal, emergency deletion

Quarterly consent review; immediate removal on withdrawal; emergency deletion procedure = delete
the secret-store entry, purge any debug captures, rotate the canary runner's credentials, and
record the deletion with the opaque ID.

## Public mirror

`packages/providers/fixtures` mirrors the _shapes_ of corpus cases with synthetic data and never
copies a real identifier.

## What unblocks it

The maintainer sourcing consented addresses in the proposed launch markets (ADR-001) and
provisioning the secret store. Until then, PLA-349 remains open and every live test is blocked.
