import SearchPageClient from './_client/search-page.client';

export default function HomePage() {
  return (
    <main>
      <SearchPageClient />
      <aside className="prose foundation-note">
        <h2>About this build</h2>
        <p>
          This is the M2 search core running against{' '}
          <strong>deterministic synthetic reference providers</strong>. No real internet provider is
          contacted, launch markets are a development-only synthetic registry, and every
          availability state you see is derived from typed evidence (never guessed). See the{' '}
          <a href="https://github.com/oliverdougherC/isp-search/tree/main/docs">documentation</a>{' '}
          and ADRs for what is decided, what is gated, and why.
        </p>
      </aside>
    </main>
  );
}
