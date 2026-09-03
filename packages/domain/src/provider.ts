import { z } from 'zod';

import { Technology } from './technology.js';

/**
 * Provider identity vocabulary (PLA-360/366). The persistent directory lives in the database;
 * these schemas define what any layer may say about a provider, and the URL rules that keep
 * user-facing links on approved official domains.
 */

export const ProviderId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'provider id must be a lowercase slug');
export type ProviderId = z.infer<typeof ProviderId>;

export const OfficialLinkKind = z.enum([
  'homepage',
  'availability',
  'order',
  'broadband_facts',
  'support',
  'terms',
  'privacy',
  'correction',
]);
export type OfficialLinkKind = z.infer<typeof OfficialLinkKind>;

export const ProviderRef = z
  .object({
    providerId: ProviderId,
    displayName: z.string().min(1).max(120),
    technologies: z.array(Technology).max(6),
  })
  .strict();
export type ProviderRef = z.infer<typeof ProviderRef>;

/**
 * Whether a URL may be shown to users as an official provider link (PLA-366):
 * HTTPS only, no embedded credentials, and the host must be an approved official domain or a
 * subdomain of one. User- or source-supplied redirect targets never pass this by construction
 * because the approved list is maintainer-reviewed configuration.
 */
export function isApprovedOfficialUrl(url: string, approvedHosts: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username !== '' || parsed.password !== '') return false;
  const host = parsed.hostname.toLowerCase();
  return approvedHosts.some((approved) => {
    const a = approved.toLowerCase();
    return host === a || host.endsWith(`.${a}`);
  });
}
