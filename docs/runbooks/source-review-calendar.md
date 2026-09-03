# Runbook: recurring source and terms review

| Check                                           | Cadence                                              | Where to record                                                           |
| ----------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| FCC BDC data vintage and Fabric version         | at each BDC release (about twice yearly) and monthly | `docs/sources/launch-matrix.json` (`bdc_vintage`), ADR-003 review trigger |
| FCC 26-48 § 8.1(a) effective-date public notice | monthly until announced                              | `docs/sources/candidate-discovery-matrix.md` FCC 26-48 section; PLA-382   |
| Provider terms, privacy policy, robots.txt      | quarterly and before enabling any adapter            | `docs/sources/provider-terms-review.md` review dates                      |
| Provider acquisitions and rebrands              | quarterly                                            | provider directory (`provider_brands`), provider matrix identity rows     |
| Launch registry entries (`last_reviewed`)       | quarterly                                            | `docs/sources/launch-matrix.json`                                         |
| Resolver vendor terms and pricing               | before signature and annually                        | ADR-002                                                                   |
| Dependency and action updates                   | weekly (Dependabot)                                  | pull requests                                                             |
