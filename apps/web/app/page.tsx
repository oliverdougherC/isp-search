import { AvailabilityState } from '@isp-search/domain';
import { AvailabilityBadge } from '@isp-search/ui';

export default function HomePage() {
  return (
    <article className="prose">
      <h1>ISP Search — foundation build</h1>
      <p>
        This deployment is the engineering foundation for a public beta.{' '}
        <strong>There is no live address search yet.</strong> Nothing on this page contacts an
        internet provider, and no address is collected.
      </p>
      <h2>What exists today</h2>
      <ul>
        <li>A typed domain vocabulary for availability states and adapter outcomes.</li>
        <li>Deterministic reference adapters backed by synthetic fixtures (no real providers).</li>
        <li>PostgreSQL migrations, a PostgreSQL-backed job queue, and health endpoints.</li>
        <li>
          Privacy invariants enforced by tests: no raw address in logs, errors, fixtures, or
          bundles.
        </li>
      </ul>
      <h2>Availability states the product will use</h2>
      <p>Every state is labelled in text. Colour is reinforcement only.</p>
      <ul className="state-list">
        {AvailabilityState.options.map((state) => (
          <li key={state}>
            <AvailabilityBadge state={state} />
          </li>
        ))}
      </ul>
      <p>
        Read the{' '}
        <a href="https://github.com/oliverdougherC/isp-search/tree/main/docs">documentation</a> and
        the architecture decision records for what is decided, what is gated, and why.
      </p>
    </article>
  );
}
