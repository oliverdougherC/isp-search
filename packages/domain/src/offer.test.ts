import { describe, expect, it } from 'vitest';

import { knownMoney, knownSpeed, unknownMoney, unknownSpeed } from './money.js';
import { AddressOffer, CatalogPlan, type PriceComponent } from './offer.js';
import type { Provenance } from './provenance.js';

const provenance: Provenance = {
  schemaVersion: 1,
  sourceType: 'synthetic',
  sourceDomain: 'example.com',
  sourceUrl: 'https://example.com/reference',
  retrievedAt: '2026-09-03T00:00:00.000Z',
  dataVintage: null,
  lastReviewed: '2026-09-01',
  geographicPrecision: 'address',
  adapterVersion: '1.0.0',
  parserVersion: '1.0.0',
  contentHash: null,
  limitations: [],
};

const baseComponent: PriceComponent = {
  type: 'base_recurring',
  label: 'Base rate',
  amount: knownMoney(6500),
  cadence: 'monthly',
  appliesFromMonth: null,
  appliesThroughMonth: null,
  requiredConditions: [],
  included: true,
};

const plan = {
  kind: 'catalog_plan',
  schemaVersion: 1,
  providerId: 'reference-available',
  planKey: 'fiber-1gig',
  name: 'Fiber 1 Gig',
  technology: 'fiber',
  download: knownSpeed(1000),
  upload: knownSpeed(1000),
  typicalLatencyMs: 12,
  dataAllowance: { kind: 'unlimited' },
  broadbandFactsUrl: null,
  provenance,
} as const;

const offer = {
  kind: 'address_offer',
  schemaVersion: 1,
  providerId: 'reference-available',
  offerKey: 'fiber-1gig-promo',
  planKey: 'fiber-1gig',
  name: 'Fiber 1 Gig (12mo promo)',
  technology: 'fiber',
  download: knownSpeed(1000),
  upload: unknownSpeed('not_disclosed'),
  dataAllowance: { kind: 'unlimited' },
  contract: { kind: 'none' },
  priceComponents: [baseComponent],
  postPromotionMonthly: unknownMoney('not_disclosed'),
  conditions: [],
  orderUrl: null,
  broadbandFactsUrl: null,
  provenance,
} as const;

describe('plan/offer separation', () => {
  it('parses a valid catalog plan and a valid address offer', () => {
    expect(CatalogPlan.parse(plan).kind).toBe('catalog_plan');
    expect(AddressOffer.parse(offer).kind).toBe('address_offer');
  });

  it('a catalog plan cannot pass as an address offer, nor the reverse', () => {
    expect(AddressOffer.safeParse(plan).success).toBe(false);
    expect(CatalogPlan.safeParse(offer).success).toBe(false);
    // Type-level: assigning one to the other is a compile error via the `kind` discriminant.
    // @ts-expect-error catalog plan is not an address offer
    const wrong: AddressOffer = plan;
    expect(wrong.kind).toBe('catalog_plan');
  });

  it('unknown post-promotion price and unknown upload survive round-tripping without zeros', () => {
    const parsed = AddressOffer.parse(offer);
    expect(parsed.postPromotionMonthly).toEqual({ kind: 'unknown', reason: 'not_disclosed' });
    expect(parsed.upload).toEqual({ kind: 'unknown', reason: 'not_disclosed' });
  });

  it('an offer requires at least one price component', () => {
    expect(AddressOffer.safeParse({ ...offer, priceComponents: [] }).success).toBe(false);
  });

  it('a discount can require conditions without hiding them', () => {
    const discount: PriceComponent = {
      type: 'recurring_discount',
      label: 'Auto Pay discount',
      amount: knownMoney(-500),
      cadence: 'monthly',
      appliesFromMonth: 1,
      appliesThroughMonth: null,
      requiredConditions: ['auto_pay', 'paperless_billing'],
      included: true,
    };
    const parsed = AddressOffer.parse({ ...offer, priceComponents: [baseComponent, discount] });
    expect(parsed.priceComponents[1]?.requiredConditions).toEqual([
      'auto_pay',
      'paperless_billing',
    ]);
  });
});
