import type { AvailabilityState } from '@isp-search/domain';

/**
 * Copy for each availability state. The label and description are the primary signal;
 * the glyph and color are reinforcement only (WCAG 1.4.1: never color alone).
 */
export const AVAILABILITY_COPY: Readonly<
  Record<
    AvailabilityState,
    { readonly label: string; readonly description: string; readonly glyph: string }
  >
> = {
  verified_available: {
    label: 'Verified available',
    description: 'The provider confirmed service for this exact address.',
    glyph: '✓',
  },
  verified_unavailable: {
    label: 'Verified unavailable',
    description: 'The provider explicitly said it does not serve this address.',
    glyph: '✕',
  },
  reported_available: {
    label: 'Reported available',
    description:
      'A regulatory or licensed location-level source reports service; not confirmed by the provider.',
    glyph: '◐',
  },
  likely_available: {
    label: 'Likely available',
    description:
      'Area-level evidence suggests the provider may serve this area. Check with the provider.',
    glyph: '○',
  },
  unknown: {
    label: 'Unknown',
    description: 'We could not determine availability. This is not a “no”.',
    glyph: '?',
  },
};

export interface AvailabilityBadgeProps {
  readonly state: AvailabilityState;
  readonly retrievedAt?: string;
}

export function AvailabilityBadge({ state, retrievedAt }: AvailabilityBadgeProps) {
  const copy = AVAILABILITY_COPY[state];
  return (
    <span className={`availability-badge availability-badge--${state}`} data-state={state}>
      <span aria-hidden="true" className="availability-badge__glyph">
        {copy.glyph}
      </span>
      <span className="availability-badge__label">{copy.label}</span>
      <span className="visually-hidden">. {copy.description}</span>
      {retrievedAt ? (
        <time className="availability-badge__time" dateTime={retrievedAt}>
          {' '}
          retrieved {retrievedAt}
        </time>
      ) : null}
    </span>
  );
}
