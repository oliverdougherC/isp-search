# Runbook: disable or downgrade a provider

Every provider can be downgraded to link-only without a code change or deployment of new code.

1. Remove the provider id from the enabled set passed to `createAdapterRegistry` (in M2 this is
   the `ENABLED_PROVIDER_IDS` configuration value). Disabled adapters still exist in the registry
   but `enabled` is `false`, so orchestration renders the official link instead of running the
   adapter.
2. Set `provider_brands.adapter_support` to `link_only` (or `disabled`) for the provider so the
   directory and UI reflect the change immediately.
3. Record the reason and date in `docs/sources/provider-terms-review.md` and, if the integration
   tier changed, amend ADR-004.
4. If the cause is a block, CAPTCHA, or upstream change, do **not** attempt a workaround. Open a
   Linear issue with the typed outcome distribution (no payloads) and the fixture fingerprint that
   drifted.

Re-enabling requires the adapter approval checklist in the planning document "Data Sources,
Compliance, and Adapter Policy" and a fresh terms review date.
