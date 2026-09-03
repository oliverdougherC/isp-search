'use client';

import type { ProviderResult, SearchCreated, SearchResource } from '@isp-search/domain';
import { AvailabilityBadge } from '@isp-search/ui';
import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal M2 search surface (PLA-370): enough product to exercise every search-core state
 * end to end. Truth semantics over polish — every state is labelled in text, unknown data
 * says "not disclosed", and the ADR-001 completeness statement renders verbatim.
 */

interface Money {
  readonly kind: 'known' | 'unknown';
  readonly amountCents?: number;
  readonly reason?: string;
}

function money(value: Money | undefined): string {
  if (!value) return 'Not disclosed';
  if (value.kind === 'known' && typeof value.amountCents === 'number') {
    const sign = value.amountCents < 0 ? '−' : '';
    return `${sign}$${(Math.abs(value.amountCents) / 100).toFixed(2)}`;
  }
  return `Not disclosed${value.reason ? ` (${value.reason.replaceAll('_', ' ')})` : ''}`;
}

function speed(value: { kind: string; mbps?: number; basis?: string }): string {
  if (value.kind !== 'known' || typeof value.mbps !== 'number') return 'not disclosed';
  return `${String(value.mbps)} Mbps ${value.basis ?? ''}`.trim();
}

const AVAILABILITY_RANK: Readonly<Record<string, number>> = {
  verified_available: 0,
  reported_available: 1,
  likely_available: 2,
  unknown: 3,
  verified_unavailable: 4,
};

const JOB_STATE_COPY: Readonly<Record<string, string>> = {
  queued: 'Waiting to check…',
  running: 'Checking…',
  succeeded: 'Check finished',
  action_required: 'Needs your input',
  degraded: 'Could not check (see why below)',
  failed_terminal: 'Check failed',
  expired: 'Ran out of time',
};

interface FormState {
  line1: string;
  unit: string;
  city: string;
  region: string;
  postalCode: string;
}

const DEFAULT_FORM: FormState = {
  line1: '100 Synthetic Way',
  unit: '',
  city: 'Fixtureville',
  region: 'ZZ',
  postalCode: '00000',
};

const CONSENT_VERSION = 'dev-2026-09';

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { code?: string; message?: string };
    return body.message ?? body.code ?? `error ${String(response.status)}`;
  } catch {
    return `error ${String(response.status)}`;
  }
}

export default function SearchPageClient() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [consented, setConsented] = useState(false);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [resource, setResource] = useState<SearchResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pollNonce, setPollNonce] = useState(0);

  // The polling loop: one effect owns the timer; actions bump `pollNonce` to refresh now.
  useEffect(() => {
    if (!searchId || expired) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async (): Promise<void> => {
      const response = await fetch(`/api/searches/${searchId}`, { cache: 'no-store' });
      if (cancelled) return;
      if (response.status === 410) {
        setExpired(true);
        setResource(null);
        return;
      }
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const body = (await response.json()) as SearchResource;
      setResource(body);
      if (!['complete', 'failed', 'expired'].includes(body.state)) {
        timer = setTimeout(() => {
          void tick();
        }, body.pollIntervalMs);
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [searchId, expired, pollNonce]);

  const restart = useCallback(() => {
    setSearchId(null);
    setResource(null);
    setError(null);
    setExpired(false);
  }, []);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/searches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          apiVersion: 1,
          address: {
            line1: form.line1,
            unit: form.unit.trim() === '' ? null : form.unit,
            city: form.city,
            region: form.region,
            postalCode: form.postalCode,
          },
          consentVersion: CONSENT_VERSION,
        }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const created = (await response.json()) as SearchCreated;
      setSearchId(created.id);
    } finally {
      setSubmitting(false);
    }
  }, [form]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      if (!searchId) return;
      setError(null);
      const response = await fetch(`/api/searches/${searchId}/actions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiVersion: 1, ...body }),
      });
      if (!response.ok && response.status !== 409) {
        setError(await readError(response));
      }
      setPollNonce((nonce) => nonce + 1);
    },
    [searchId],
  );

  if (!searchId) {
    return (
      <section className="search-shell">
        <h1>ISP Search (development build)</h1>
        <p>
          This is the deterministic M2 search core. It checks{' '}
          <strong>synthetic reference providers only</strong> — no real internet provider is
          contacted. Try street lines containing <code>Mdu</code>, <code>Ambiguous</code>,{' '}
          <code>Invalid</code>, or <code>Unsupported</code> to exercise each workflow.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="search-form"
        >
          <label>
            Street address
            <input
              required
              value={form.line1}
              onChange={(event) => {
                setForm({ ...form, line1: event.target.value });
              }}
            />
          </label>
          <label>
            Unit / apartment (optional)
            <input
              value={form.unit}
              onChange={(event) => {
                setForm({ ...form, unit: event.target.value });
              }}
            />
          </label>
          <label>
            City
            <input
              required
              value={form.city}
              onChange={(event) => {
                setForm({ ...form, city: event.target.value });
              }}
            />
          </label>
          <label>
            State
            <input
              required
              maxLength={2}
              value={form.region}
              onChange={(event) => {
                setForm({ ...form, region: event.target.value.toUpperCase() });
              }}
            />
          </label>
          <label>
            ZIP
            <input
              required
              value={form.postalCode}
              onChange={(event) => {
                setForm({ ...form, postalCode: event.target.value });
              }}
            />
          </label>
          <label className="consent">
            <input
              type="checkbox"
              checked={consented}
              onChange={(event) => {
                setConsented(event.target.checked);
              }}
            />
            I understand this address and unit may be sent to the selected providers to check
            service. (In this development build, only deterministic synthetic providers exist.)
          </label>
          <button type="submit" disabled={!consented || submitting}>
            {submitting ? 'Starting…' : 'Search providers'}
          </button>
        </form>
      </section>
    );
  }

  if (expired) {
    return (
      <section className="search-shell">
        <h1>This search has expired</h1>
        <p>Search results and the address you entered have been deleted, as designed.</p>
        <button onClick={restart}>Start a new search</button>
      </section>
    );
  }

  if (!resource) {
    return (
      <section className="search-shell">
        <p role="status">Starting search…</p>
        {error ? <p className="error">{error}</p> : null}
        <button onClick={restart}>Start over</button>
      </section>
    );
  }

  const providers = [...resource.providers].sort(
    (a, b) => (AVAILABILITY_RANK[a.availability] ?? 9) - (AVAILABILITY_RANK[b.availability] ?? 9),
  );
  const settledCount = resource.providers.filter((p) =>
    ['succeeded', 'degraded', 'failed_terminal', 'expired'].includes(p.jobState ?? ''),
  ).length;
  const jobCount = resource.providers.filter((p) => p.jobState !== null).length;

  return (
    <section className="search-shell">
      <header className="search-header">
        <h1>Search results</h1>
        {resource.displayAddress ? (
          <p className="display-address">{resource.displayAddress}</p>
        ) : null}
        <p role="status">
          Status: <strong>{resource.state.replaceAll('_', ' ')}</strong>
          {jobCount > 0
            ? ` — ${String(settledCount)} of ${String(jobCount)} provider checks finished`
            : ''}
          {resource.reasonCode ? ` (${resource.reasonCode.replaceAll('_', ' ')})` : ''}
        </p>
        <button onClick={restart}>New search</button>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {resource.state === 'address_action_required' ? (
        <AddressActionPanel resource={resource} act={act} />
      ) : null}

      {resource.market && !resource.market.supported ? (
        <div className="notice">
          <h2>Outside supported areas</h2>
          <p>
            This address is outside the current launch markets, so no provider was checked and
            nothing here means providers are unavailable. You can check the official FCC map
            yourself:
          </p>
          <a href={resource.fccMapUrl} rel="noreferrer" target="_blank">
            FCC National Broadband Map
          </a>
        </div>
      ) : null}

      {resource.market?.supported ? (
        <p className="market-line">
          Market: {resource.market.name} ({resource.market.status?.replaceAll('_', ' ')}) — registry{' '}
          {resource.market.registryVersion}, reviewed {resource.market.lastReviewed}.{' '}
          {resource.market.attribution}
        </p>
      ) : null}

      <div className="provider-list">
        {providers.map((provider) => (
          <ProviderCard key={provider.providerId} provider={provider} act={act} />
        ))}
      </div>

      <footer className="completeness">
        <h2>What this search means</h2>
        <p>{resource.completenessStatement}</p>
        <p>
          <a href={resource.fccMapUrl} rel="noreferrer" target="_blank">
            FCC National Broadband Map
          </a>
        </p>
      </footer>
    </section>
  );
}

function AddressActionPanel({
  resource,
  act,
}: {
  readonly resource: SearchResource;
  readonly act: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [unit, setUnit] = useState('');
  if (resource.requiredAction === 'select_candidate') {
    return (
      <div className="notice" role="group" aria-label="Choose your address">
        <h2>Which address did you mean?</h2>
        {resource.addressCandidates.map((candidate) => (
          <button
            key={candidate.id}
            onClick={() => {
              void act({
                type: 'select_candidate',
                candidateId: candidate.id,
                epoch: resource.actionEpoch,
              });
            }}
          >
            {candidate.label}
          </button>
        ))}
      </div>
    );
  }
  if (resource.requiredAction === 'provide_unit') {
    return (
      <div className="notice" role="group" aria-label="Unit required">
        <h2>This building has multiple units</h2>
        <p>Pick your unit (or type it) so providers can check the exact address:</p>
        {resource.unitOptions.map((option) => (
          <button
            key={option}
            onClick={() => {
              void act({ type: 'provide_unit', unit: option, epoch: resource.actionEpoch });
            }}
          >
            {option}
          </button>
        ))}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (unit.trim() !== '') {
              void act({ type: 'provide_unit', unit, epoch: resource.actionEpoch });
            }
          }}
        >
          <label>
            Other unit
            <input
              value={unit}
              onChange={(event) => {
                setUnit(event.target.value);
              }}
            />
          </label>
          <button type="submit">Use this unit</button>
        </form>
      </div>
    );
  }
  return (
    <div className="notice">
      <h2>We could not use that address</h2>
      <p>Start a new search and check the street, city, state, and ZIP.</p>
    </div>
  );
}

function ProviderCard({
  provider,
  act,
}: {
  readonly provider: ProviderResult;
  readonly act: (body: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <article className="provider-card" aria-label={provider.displayName}>
      <header>
        <h3>{provider.displayName}</h3>
        <AvailabilityBadge state={provider.availability} />
        <p className="tech-line">
          {provider.technologies.map((t) => t.replaceAll('_', ' ')).join(', ') ||
            'technology unknown'}
          {provider.capacityBasedEligibility
            ? ' — eligibility is capacity-based and can change'
            : ''}
        </p>
      </header>
      <p className="job-line">
        {provider.jobState
          ? (JOB_STATE_COPY[provider.jobState] ?? provider.jobState)
          : 'Not checked automatically — use the official link below'}
        {provider.outcome && provider.jobState !== 'succeeded'
          ? ` (${provider.outcome.replaceAll('_', ' ')})`
          : ''}
        {provider.diagnosticCode === 'qualification_cache_reuse'
          ? ' — reused a recent check for this exact address'
          : ''}
      </p>

      {provider.actionRequired ? (
        <div className="notice" role="group" aria-label={`${provider.displayName} needs input`}>
          <p>{provider.displayName} needs to know which unit/building applies:</p>
          {provider.actionRequired.options.map((option) => (
            <button
              key={option}
              onClick={() => {
                void act({
                  type: 'provider_choice',
                  providerId: provider.providerId,
                  choice: option,
                });
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}

      {provider.offers.map((offer) => (
        <div className="offer" key={offer.offerKey}>
          <h4>{offer.name}</h4>
          <p>
            Download {speed(offer.download)} · Upload {speed(offer.upload)} ·{' '}
            {offer.dataAllowance.kind === 'unlimited'
              ? 'No data cap'
              : offer.dataAllowance.kind === 'capped'
                ? `${String(offer.dataAllowance.gigabytes)} GB data cap`
                : 'Data policy not disclosed'}{' '}
            ·{' '}
            {offer.contract.kind === 'none'
              ? 'No contract'
              : offer.contract.kind === 'term'
                ? `${String(offer.contract.months)}-month contract (early termination ${money(offer.contract.earlyTerminationFee as Money)})`
                : 'Contract terms not disclosed'}
          </p>
          <ul className="price-components">
            {offer.priceComponents.map((component, index) => (
              <li key={index}>
                {component.label}: {money(component.amount as Money)}
                {component.cadence === 'monthly' ? '/mo' : ' one-time'}
                {component.appliesFromMonth !== null || component.appliesThroughMonth !== null
                  ? ` (months ${String(component.appliesFromMonth ?? 1)}–${component.appliesThroughMonth === null ? 'ongoing' : String(component.appliesThroughMonth)})`
                  : ''}
                {component.requiredConditions.length > 0
                  ? ` — requires ${component.requiredConditions.map((c) => c.replaceAll('_', ' ')).join(', ')}`
                  : ''}
                {component.included ? '' : ' (optional)'}
              </li>
            ))}
          </ul>
          <p>
            Price after promotions: <strong>{money(offer.postPromotionMonthly as Money)}</strong>
          </p>
          {offer.conditions.length > 0 ? (
            <ul className="conditions">
              {offer.conditions.map((condition, index) => (
                <li key={index}>{condition.description ?? condition.type.replaceAll('_', ' ')}</li>
              ))}
            </ul>
          ) : null}
          <p className="provenance">
            Source: {offer.provenance.sourceType.replaceAll('_', ' ')} · retrieved{' '}
            {new Date(offer.provenance.retrievedAt).toLocaleString()}
            {offer.broadbandFactsUrl ? (
              <>
                {' · '}
                <a href={offer.broadbandFactsUrl} rel="noreferrer" target="_blank">
                  Broadband Facts label
                </a>
              </>
            ) : (
              ' · no Broadband Facts label found'
            )}
          </p>
        </div>
      ))}

      {provider.evidence.length > 0 ? (
        <details className="evidence">
          <summary>Why this provider is listed</summary>
          <ul>
            {provider.evidence.map((evidence, index) => (
              <li key={index}>
                {evidence.evidenceClass.replaceAll('_', ' ')} ({evidence.geographicPrecision}{' '}
                precision, {evidence.freshness}) — {evidence.limitations.join('; ')}
                {evidence.sourceUrl ? (
                  <>
                    {' '}
                    <a href={evidence.sourceUrl} rel="noreferrer" target="_blank">
                      source
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="links">
        {provider.officialLinks.availability ? (
          <a href={provider.officialLinks.availability} rel="noreferrer" target="_blank">
            Check on {provider.displayName}&rsquo;s official site
          </a>
        ) : null}
      </p>
    </article>
  );
}
