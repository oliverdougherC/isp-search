import { AvailabilityState } from '@isp-search/domain';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AVAILABILITY_COPY, AvailabilityBadge } from './availability-badge.js';

describe('AvailabilityBadge', () => {
  it('renders a text label and description for every state (never color alone)', () => {
    for (const state of AvailabilityState.options) {
      const html = renderToStaticMarkup(<AvailabilityBadge state={state} />);
      expect(html).toContain(AVAILABILITY_COPY[state].label);
      expect(html).toContain(AVAILABILITY_COPY[state].description);
      expect(html).toContain(`data-state="${state}"`);
    }
  });

  it('exposes retrieval time as a machine-readable <time>', () => {
    const html = renderToStaticMarkup(
      <AvailabilityBadge state="verified_available" retrievedAt="2026-09-02T12:00:00Z" />,
    );
    expect(html.toLowerCase()).toContain('datetime="2026-09-02t12:00:00z"');
  });
});
