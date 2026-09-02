export {
  AvailabilityState,
  AdapterOutcome,
  EvidenceClass,
  EVIDENCE_PRIORITY,
  TERMINAL_OUTCOMES,
  TRANSIENT_OUTCOMES,
  mapOutcomeToAvailability,
  mapCandidateEvidenceToAvailability,
  classifyRetry,
  type RetryClass,
} from './availability.js';
export {
  SearchState,
  ProviderJobState,
  SEARCH_TRANSITIONS,
  TERMINAL_SEARCH_STATES,
  canTransition,
} from './search-state.js';
export {
  StructuredAddress,
  UsRegionCode,
  AddressPrecision,
  AddressValidationState,
  canonicalizeForIdentity,
} from './address.js';
export {
  SYNTHETIC_STREET_TOKENS,
  SYNTHETIC_REGION,
  SYNTHETIC_POSTAL_PREFIX,
  SYNTHETIC_CITY,
  SyntheticAddress,
  isSyntheticAddress,
  syntheticAddress,
  type SyntheticAddressOptions,
} from './synthetic.js';
