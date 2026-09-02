# Security policy

## Reporting a vulnerability or privacy issue

Please **do not** open a public issue for security or privacy problems.

Use GitHub's private vulnerability reporting for this repository:
<https://github.com/oliverdougherC/isp-search/security/advisories/new>

Include what you found, how to reproduce it, and the impact you believe it has. If a report
involves a real residential address or personal data, describe the shape of the data rather
than including the data itself.

## What counts

- Any path by which a raw address or unit can reach logs, traces, metrics, analytics, URLs,
  error responses, client bundles, fixtures, screenshots, or long-lived storage.
- Secret or credential exposure, including in CI logs and build artifacts.
- SSRF, injection, unsafe redirect, or unsafe handling of provider-supplied content.
- Weaknesses in the address identity scheme (the versioned keyed HMAC) or key handling.
- Abuse vectors: address enumeration, provider traffic amplification, cache probing.

## Response

The maintainer acknowledges reports within five business days and keeps the reporter informed
until the issue is resolved. Fixes for confirmed issues are released before any public
disclosure, and reporters are credited if they wish.

## Supported versions

This repository is pre-release. Only the `main` branch receives fixes.

## Scope notes

The project never solves or bypasses CAPTCHA, rotates proxies, spoofs browser fingerprints,
defeats rate limits or WAFs, or automates authenticated customer accounts. Reports proposing
such techniques will be declined.
