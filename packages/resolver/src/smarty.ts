import type { ResolvedAddress } from '@isp-search/domain';

import {
  ResolverUnavailableError,
  type AddressResolver,
  type ResolveInput,
  type ResolverContext,
} from './contract.js';

/**
 * Smarty adapter placeholder (ADR-002, PLA-363).
 *
 * The M0 decision selects Smarty as the production resolver, but as of Round 2:
 *  - no consented live test corpus exists (PLA-349), so no live call is authorized;
 *  - no credentials or signed quote exist (maintainer action in ADR-002).
 *
 * This class therefore holds the configuration surface and the gate, and nothing else: it can
 * be constructed with credentials, but `resolve` refuses to run until the adapter is enabled
 * AND live validation prerequisites are met. The HTTP request/response mapping is written
 * together with the live validation work (PLA-349/PLA-344) so it can be verified against real
 * vendor behavior instead of guessed — a mapping that has never seen a response would be
 * untested code masquerading as an integration.
 *
 * Synthetic addresses must NEVER be sent to Smarty/CASS paths (ADR-002).
 */

export interface SmartyResolverConfig {
  readonly authId: string | undefined;
  readonly authToken: string | undefined;
  /** Explicit opt-in; defaults to false everywhere. */
  readonly enabled: boolean;
}

export const SMARTY_RESOLVER_ID = 'smarty';
export const SMARTY_RESOLVER_VERSION = '0.0.0-gated';

export function createSmartyResolver(config: SmartyResolverConfig): AddressResolver {
  return {
    id: SMARTY_RESOLVER_ID,
    version: SMARTY_RESOLVER_VERSION,
    resolve(_input: ResolveInput, _context: ResolverContext): Promise<ResolvedAddress> {
      if (!config.enabled) {
        return Promise.reject(new ResolverUnavailableError('disabled'));
      }
      if (config.authId === undefined || config.authToken === undefined) {
        return Promise.reject(new ResolverUnavailableError('not_configured'));
      }
      // Live path intentionally unimplemented until PLA-349 provides a consented corpus and
      // the maintainer provisions credentials/terms (ADR-002 unresolved risks).
      return Promise.reject(new ResolverUnavailableError('disabled'));
    },
  };
}
