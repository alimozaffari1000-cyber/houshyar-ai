# Houshyar Trade — Global Commerce Foundation
## Product and architecture proposal (v1)

**Status:** Architecture proposal only. This is not a deployed or operational trading service.

## 1. Product mandate
Houshyar is a global platform. Commerce must be a first-class capability, not merely a directory or referral funnel. Houshyar Trade is the commerce layer for discovering counterparties, expressing demand and supply, negotiating, managing orders, and coordinating trusted third-party services across borders.

It supports domestic commerce (local discovery, retail, wholesale, services, pickup and delivery) and cross-border commerce (import/export discovery, RFQs, multilingual negotiation, trade documentation, logistics coordination, and compliant payment-provider integrations). It shares identity, localization, AI orchestration, trust, notifications, and marketplace foundations with Houshyar.

## 2. Product principles
1. User value before monetization; no recruitment-based revenue model.
2. Trust by design: distinguish verified facts, user claims, platform checks, and third-party attestations.
3. Country-aware by default: currencies, units, tax concepts, shipping terms, product restrictions, and laws vary by jurisdiction.
4. Human control: AI may draft, compare, summarize, and recommend; it cannot independently accept contracts, release funds, place binding orders, or make customs declarations.
5. No false guarantees: seller verification does not guarantee product quality, solvency, delivery, or legal compliance.
6. Interoperability through adapters for payment, logistics, identity, translation, and trade-data providers.
7. Privacy and least privilege: tenant-scoped access, minimum necessary data, explicit consent, audit trails, and retention controls.
8. Progressive activation: build discovery and RFQ before regulated financial or logistics operations.

## 3. Main user journeys
### Buyer
1. Describe a product or service need in natural language.
2. AI extracts category, specification, quantity, destination, budget, delivery window, and required documents.
3. Search listings with clear trust labels.
4. Compare suppliers by price, MOQ, lead time, location, certifications, shipping options, and response history.
5. Send an RFQ to selected suppliers.
6. Receive offers and negotiate with AI-assisted translation.
7. Select an offer and create an order draft.
8. Review and explicitly accept commercial terms.
9. Track fulfillment and use documented issue-resolution workflows.

### Seller / supplier
1. Create an individual or business profile.
2. Submit business identity and evidence appropriate to country and risk tier.
3. Publish structured listings with origin, availability, MOQ, price basis, and permitted destinations.
4. Receive RFQs and submit versioned offers.
5. Convert an accepted offer into an order draft.
6. Update fulfillment milestones and provide evidence.
7. Build reputation from eligible completed transactions and dispute outcomes.

### Local buyer
1. Ask for a nearby item or service (for example, an apple).
2. See nearby providers and distinguish pickup, delivery, and online ordering.
3. Compare price, distance, hours, delivery fee, and availability where reliable data exists.
4. Place an order only through an enabled provider flow.

## 4. Product modules
| Module | Responsibility | Initial release |
|---|---|---|
| Global catalog | Categories, listings, attributes, media, origin, availability | Read/publish listings |
| Supplier and buyer profiles | Business identity, locations, capabilities, verification | Profiles and review queue |
| Discovery engine | Search, filters, recommendations, comparable offers | Search and filters |
| RFQ and sourcing | Buyer requirements, supplier invitations, deadlines | Create/respond/close RFQ |
| Offer and negotiation | Versioned quotes, validity, terms, multilingual messages | Draft offers and messages |
| Order management | Accepted-offer snapshot, milestones, evidence, cancellation | Draft and manually confirmed order |
| Trust and reputation | Verification levels, reviews, reports, disputes | Evidence review and moderation |
| AI trade assistant | Requirement extraction, translation, summaries, comparison, document drafts | Assistive, human-reviewed |
| Logistics coordination | Shipping quotes, tracking adapters, customs checklist | Provider referrals and status capture |
| Payments | Provider checkout, refunds, reconciliation | Disabled until legal/provider review |
| Analytics | Demand signals, price ranges, country/category trends | Aggregate privacy-safe insights |
| Local commerce | Nearby shops, availability, pickup and delivery | Listings and outbound order links |

## 5. Core domain model (proposal; no migrations yet)
- business_profiles: owner, legal name, country, registration references, profile status.
- business_members: user-to-business membership and role.
- verification_cases: checks, evidence references, reviewer, outcome, expiry.
- catalog_categories: hierarchical localized taxonomy.
- listings: seller, category, listing type, status, origin country, visibility.
- listing_attributes: typed attributes and units.
- listing_prices: amount, ISO currency, pricing unit, minimum quantity, validity.
- listing_media: controlled references to uploaded media.
- rfqs: buyer, destination, requirements, quantity, deadline, status.
- rfq_invites: invited suppliers and response status.
- offers: supplier response, version, line items, price basis, lead time, Incoterms field, validity.
- conversations and messages: participants, business context, locale, private content references.
- orders: accepted offer snapshot, buyer/seller, state, currency, total, consent timestamps.
- order_events: append-only status history and actor.
- fulfillment_records: carrier/provider, tracking reference, milestones, evidence references.
- disputes: reason, evidence, state, resolution and appeal history.
- provider_connections: provider type, country coverage, capability and status; never store raw secrets here.
- payment_intents: provider reference, amount, currency, state, idempotency key; no raw card or wallet secrets.
- audit_events: security-sensitive actor/action/target metadata.

Every business-owned row must be tenant-scoped. Authorization must be enforced in database predicates, not only in UI code.

## 6. State machines and integrity
- Listing: draft -> pending_review -> active -> paused/rejected/archived.
- RFQ: draft -> open -> partially_quoted -> quoted -> closed/cancelled/expired.
- Offer: draft -> submitted -> revised -> accepted/rejected/withdrawn/expired.
- Order: draft -> awaiting_human_confirmation -> confirmed -> fulfillment_pending -> in_transit -> delivered -> completed.
- Exceptional order states: cancel_requested, cancelled, disputed, refunded (only when a real provider supports it).

Only one offer version may be accepted for an RFQ/order conversion, enforced transactionally. State transitions must be explicit, authorized, idempotent, and recorded in an append-only event log.

## 7. AI capabilities and boundaries
AI may convert intent into structured RFQs; translate while preserving original text; summarize offers and highlight missing terms; compare normalized units/currencies with FX source and timestamp; draft descriptions, messages, and document checklists; and explain risk signals for human review.

AI must not invent verification, stock, prices, certifications, shipping availability, customs rules, or payment status. It must not accept offers, sign agreements, release funds, place binding orders, or submit statutory declarations. It must not make definitive legal, tax, sanctions, or customs determinations.

## 8. Trust, compliance, and safety
- Verification levels: unverified, identity_checked, business_documents_reviewed, enhanced_review, suspended.
- Show what was checked, by whom, when, and when it expires.
- Apply country/product eligibility rules before listing, RFQ, order, logistics, or payment actions.
- Use qualified providers for counterparty and restricted-goods screening where legally required.
- Review sanctions, export controls, consumer protection, privacy, tax, AML, and KYC obligations by jurisdiction.
- Never imply crypto or wallet transfers are lawful, available, reversible, or suitable in every country.
- Keep financial actions disabled until provider licensing, country coverage, refunds, reconciliation, and compliance are reviewed.
- Provide report, block, moderation, dispute, appeal, and account-restriction processes.
- Keep audit trails without copying unnecessary personal or confidential content into event metadata.

## 9. Payments and monetization
Potential revenue: transparent transaction/service fees where permitted; seller tools and business subscriptions; premium sourcing and market intelligence; clearly labeled promoted listings; enterprise integrations and API access; and optional logistics/documentation services through qualified partners.

Do not monetize through recruitment. Show fees, taxes, FX assumptions, and refund conditions before commitment. Payment architecture must be provider-agnostic. Cards, bank transfers, stablecoins, or other digital assets require country-by-country legal and provider assessment. Houshyar must not custody funds or collect private keys in the initial design.

## 10. Internationalization
- Use BCP 47 language tags and ISO 4217 currency codes.
- Store money as integer minor units or exact decimal strings, never binary floating point.
- Store timestamps in UTC and render in user locale.
- Preserve original and translated content separately.
- Normalize units while retaining seller-original units.
- Model origin/destination country and shipping terms explicitly.
- Support RTL layouts without assuming a single locale.

## 11. Security and platform architecture
- Reuse Houshyar authentication; require business membership and role checks for business resources.
- Roles: owner, admin, sales, buyer, catalog_manager, fulfillment, support, reviewer.
- Enforce tenant isolation in every query and test cross-tenant IDOR cases.
- Protect state-changing browser requests with origin/CSRF controls.
- Rate-limit search, RFQ, messaging, login, and verification submissions.
- Use signed short-lived upload URLs and malware/content checks for documents.
- Keep provider credentials in secret storage; never expose them to clients or logs.
- Use idempotency keys for order conversion, payment intents, webhooks, and provider callbacks.
- Verify webhook signatures and reject replayed events.
- Scope AI tools with allowlists, permissions, budgets, timeouts, and human approval for consequential actions.

## 12. Delivery roadmap
### Phase 0 — Foundation
Confirm launch jurisdictions and prohibited categories; finalize taxonomy, roles, state machines, retention policy; conduct buyer/seller/merchant research; complete threat model and privacy impact assessment.
### Phase 1 — Marketplace MVP
Business profiles, listings, search/filter, local discovery, RFQs, offers, messaging, translation, human-reviewed verification. No payment custody; order acceptance is a user-confirmed record only.
### Phase 2 — Transaction operations
Order workflow, event history, disputes, evidence, cancellation policy, logistics adapters, tracking, moderation, and support console.
### Phase 3 — Regulated integrations
Country-specific payment providers, required KYC/AML/sanctions integrations, tax/customs/logistics integrations, reconciliation, refunds, chargebacks, and financial controls.
### Phase 4 — Intelligence and scale
Demand/supply analytics, sourcing recommendations, enterprise APIs, procurement integrations, and additional countries after localization/compliance readiness.

## 13. MVP acceptance criteria
- Buyer can create a structured RFQ and invite suppliers.
- Supplier can submit a versioned offer.
- Buyer can compare currency, unit, MOQ, validity, and delivery terms explicitly.
- Accepting an offer requires explicit human action and creates an immutable order snapshot.
- Business resources are inaccessible to other tenants without membership.
- Every state change is authorized, idempotent, and auditable.
- Verification badges describe scope and expiry.
- AI-generated text is labeled as assistance and reviewed before sending.
- Payment and shipment states cannot be fabricated by clients or AI.
- Critical flows have tests for authorization, replay, invalid transitions, and data leakage.

## 14. Decisions required before implementation
1. Initial launch countries and excluded jurisdictions.
2. First verticals: general catalog or focused categories.
3. B2B, B2C, or staged support for both.
4. Verification provider and evidence policy per country.
5. Messaging retention and dispute evidence policy.
6. Initial logistics partners.
7. Payment provider and legal operating model.
8. Fee schedule and seller subscription boundaries.

## 15. Implementation boundary
This is a product/architecture specification only. It creates no tables, endpoints, business verification, orders, carrier connections, or payment processing. Each operational capability requires separate implementation, tests, security review, and explicit deployment approval.

## 16. Core operating model: Houshyar as the intelligent intermediary

The primary business role of Houshyar Trade is **marketplace operator and intelligent commercial intermediary**. Houshyar connects buyers, sellers, manufacturers, wholesalers, exporters, importers, merchants, and service providers. In the default model, Houshyar is not the principal buyer, seller, importer, exporter, inventory owner, or contractual counterparty to the underlying goods transaction.

### Intermediary responsibilities
- Capture buyer demand and seller supply in structured, searchable formats.
- Match both sides using product/service fit, quantity, location, destination, price range, lead time, trust signals, and stated preferences.
- Recommend suitable counterparties and explain why each match is relevant.
- Obtain user permission before sharing contact details or commercially sensitive RFQ information.
- Facilitate introductions, multilingual communication, RFQs, offers, negotiation, and meeting scheduling.
- Keep a transparent timeline of introductions, offer versions, user decisions, and agreed next steps.
- Help parties prepare order documents and coordinate optional logistics/payment partners without falsely claiming to provide those services itself.
- Support post-introduction feedback, reports, disputes, and fraud prevention under clearly disclosed platform rules.

### Matching workflow
1. Buyer submits a request or searches the catalog.
2. The system normalizes product specifications, quantity, target price, destination, delivery terms, and timing.
3. Matching ranks eligible suppliers and clearly separates verified data from seller-provided claims.
4. Buyer reviews a shortlist and chooses whom to contact.
5. Houshyar sends an RFQ or introduction only within the buyer's chosen disclosure scope.
6. Suppliers respond with time-limited, versioned offers.
7. Houshyar compares offers and assists translation and negotiation; parties communicate and decide.
8. With explicit confirmation from the parties, Houshyar records the referral/transaction milestone and any applicable fee.
9. The parties complete their contract and payment directly or through separately enabled, qualified providers.
10. Houshyar records permitted outcome signals to improve matching and reputation, subject to privacy and dispute rules.

### Commercial model for an intermediary
- **Success/referral fee:** a disclosed fee may be charged when a qualifying introduction or transaction milestone occurs, subject to local law and a clear definition of the fee trigger.
- **Subscription:** optional seller/business plans for advanced catalog tools, lead management, analytics, and team access.
- **Qualified leads:** paid lead products may be offered only with transparent rules; never sell exclusive access to a buyer's private data or misrepresent lead quality.
- **Promoted placement:** sponsored results must be visibly labeled and must not silently override relevance, eligibility, or trust ranking.
- **Enterprise sourcing:** custom sourcing and procurement workflows may be priced transparently.

Fees, payer, trigger, taxes, refunds, cancellation treatment, and any currency conversion must be shown before the user commits. No recruitment commissions or multi-level referral compensation. No fee should be represented as earned merely because a user registers or invites others.

### Trust and anti-circumvention
The platform should protect users from scams without trapping them. Disclose what Houshyar can and cannot guarantee. Offer optional on-platform messaging and milestone tracking, but do not falsely claim that an off-platform deal is protected. Any referral-fee agreement must be accepted by the paying party before introduction or before the defined fee-triggering action. Keep a fair complaint and appeal process.

### Legal boundary
The default intermediary model does not automatically make Houshyar a broker, agent, marketplace facilitator, payment institution, customs broker, or carrier in every jurisdiction. Before launch in each country, obtain qualified legal review of agency/brokerage licensing, consumer and commercial marketplace rules, privacy, competition, sanctions/export controls, tax/VAT, advertising disclosures, and payment-services boundaries. Contracts must clearly state whether Houshyar acts only as an introducer/platform or has a separately authorized agency role. Do not negotiate or bind a party as its agent without explicit authority and jurisdictional review.

### Additional acceptance criteria
- Buyer and seller can independently control what contact and business data is disclosed and when.
- Matching results explain key factors and distinguish sponsored placement from organic relevance.
- No supplier can see another supplier's quote or a buyer's private competing offers.
- A referral fee cannot be triggered without a recorded, informed acceptance of its terms.
- The platform never represents itself as seller/owner of goods unless a separately approved business model explicitly says so.
- Users can report misleading listings, fake suppliers, spam, coercion, and unauthorized data sharing.
