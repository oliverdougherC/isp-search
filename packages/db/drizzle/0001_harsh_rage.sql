CREATE TYPE "public"."adapter_outcome" AS ENUM('available', 'unavailable', 'address_ambiguous', 'unit_required', 'unsupported_market', 'captcha', 'blocked', 'rate_limited', 'timeout', 'upstream_changed', 'parse_error', 'invalid_response', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."circuit_state" AS ENUM('closed', 'open');--> statement-breakpoint
CREATE TYPE "public"."evidence_class" AS ENUM('provider_qualification', 'provider_label', 'location_level_licensed', 'area_level_reported', 'official_generic_page');--> statement-breakpoint
CREATE TYPE "public"."market_status" AS ENUM('proposed', 'approved', 'development_only');--> statement-breakpoint
CREATE TYPE "public"."money_kind" AS ENUM('known', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."price_cadence" AS ENUM('monthly', 'one_time');--> statement-breakpoint
CREATE TYPE "public"."price_component_type" AS ENUM('base_recurring', 'introductory_recurring', 'provider_fee_recurring', 'passthrough_fee_recurring', 'equipment_rental', 'equipment_purchase', 'installation', 'activation', 'one_time_credit', 'recurring_discount', 'tax_excluded', 'unknown_other');--> statement-breakpoint
CREATE TYPE "public"."provider_alias_kind" AS ENUM('alias', 'dba', 'source_id');--> statement-breakpoint
CREATE TYPE "public"."provider_job_state" AS ENUM('queued', 'running', 'succeeded', 'action_required', 'degraded', 'failed_terminal', 'expired');--> statement-breakpoint
CREATE TYPE "public"."retention_data_class" AS ENUM('raw_address', 'search_display_data', 'expired_search', 'address_offers', 'provider_artifacts', 'catalog_plans');--> statement-breakpoint
CREATE TYPE "public"."search_state" AS ENUM('created', 'resolving_address', 'address_action_required', 'discovering_candidates', 'qualifying', 'partial', 'complete', 'expired', 'failed');--> statement-breakpoint
CREATE TABLE "launch_markets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"geoids" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "market_status" DEFAULT 'proposed' NOT NULL,
	"registry_version" text NOT NULL,
	"bdc_vintage" date,
	"last_reviewed" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "launch_markets_kind" CHECK ("launch_markets"."kind" in ('cbsa','county','synthetic'))
);
--> statement-breakpoint
CREATE TABLE "provider_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"kind" "provider_alias_kind" NOT NULL,
	"source_type" text DEFAULT 'generic' NOT NULL,
	"value" text NOT NULL,
	"value_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_aliases_value_normalized_lower" CHECK ("provider_aliases"."value_normalized" = lower("provider_aliases"."value_normalized"))
);
--> statement-breakpoint
CREATE TABLE "provider_health" (
	"provider_id" text PRIMARY KEY NOT NULL,
	"circuit_state" "circuit_state" DEFAULT 'closed' NOT NULL,
	"reason" text,
	"opened_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_markets" (
	"provider_id" text NOT NULL,
	"market_id" text NOT NULL,
	"technologies" text[] DEFAULT '{}'::text[] NOT NULL,
	"capacity_based_eligibility" boolean DEFAULT false NOT NULL,
	"adapter_tier" text DEFAULT 'link_only' NOT NULL,
	"fallback_url" text,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"listing_blocked" boolean DEFAULT false NOT NULL,
	"last_reviewed" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_markets_provider_id_market_id_pk" PRIMARY KEY("provider_id","market_id")
);
--> statement-breakpoint
CREATE TABLE "evidence_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provenance" jsonb NOT NULL,
	"source_type" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qualification_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"outcome" "adapter_outcome" NOT NULL,
	"retry_class" text NOT NULL,
	"evidence_id" uuid,
	"diagnostics" jsonb,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"latency_ms" integer NOT NULL,
	CONSTRAINT "qualification_attempts_latency_nonnegative" CHECK ("qualification_attempts"."latency_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "qualification_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"adapter_version" text NOT NULL,
	"state" "provider_job_state" DEFAULT 'queued' NOT NULL,
	"outcome" "adapter_outcome",
	"action_options" jsonb,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_diagnostic_code" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qualification_jobs_settled_has_outcome" CHECK (("qualification_jobs"."settled_at" is null) or ("qualification_jobs"."outcome" is not null) or "qualification_jobs"."state" = 'expired')
);
--> statement-breakpoint
CREATE TABLE "search_address_material" (
	"search_id" text PRIMARY KEY NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"key_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"evidence_class" "evidence_class" NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_candidates_not_qualification" CHECK ("search_candidates"."evidence_class" <> 'provider_qualification')
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" text PRIMARY KEY NOT NULL,
	"state" "search_state" DEFAULT 'created' NOT NULL,
	"reason_code" text,
	"address_identity" text,
	"address_identity_version" integer,
	"display_address" text,
	"address_candidates" jsonb,
	"unit_options" jsonb,
	"required_action" text,
	"action_epoch" integer DEFAULT 0 NOT NULL,
	"resolver_id" text,
	"resolver_version" text,
	"validation_state" text,
	"address_precision" text,
	"market_id" text,
	"registry_version" text,
	"consent_version" text NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "searches_id_shape" CHECK ("searches"."id" ~ '^[A-Za-z0-9_-]{43}$'),
	CONSTRAINT "searches_identity_version_together" CHECK (("searches"."address_identity" is null) = ("searches"."address_identity_version" is null))
);
--> statement-breakpoint
CREATE TABLE "address_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"adapter_version" text NOT NULL,
	"offer_key" text NOT NULL,
	"offer" jsonb NOT NULL,
	"evidence_id" uuid,
	"address_identity" text NOT NULL,
	"address_identity_version" integer NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "address_offers_kind" CHECK ("address_offers"."offer"->>'kind' = 'address_offer')
);
--> statement-breakpoint
CREATE TABLE "catalog_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"plan_key" text NOT NULL,
	"parser_version" text NOT NULL,
	"plan" jsonb NOT NULL,
	"evidence_id" uuid,
	"observed_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_plans_kind" CHECK ("catalog_plans"."plan"->>'kind' = 'catalog_plan')
);
--> statement-breakpoint
CREATE TABLE "offer_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"condition_type" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "offer_price_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"component_type" "price_component_type" NOT NULL,
	"label" text NOT NULL,
	"amount_kind" "money_kind" NOT NULL,
	"amount_cents" integer,
	"unknown_reason" text,
	"cadence" "price_cadence" NOT NULL,
	"applies_from_month" integer,
	"applies_through_month" integer,
	"required_conditions" text[] DEFAULT '{}'::text[] NOT NULL,
	"included" boolean NOT NULL,
	CONSTRAINT "offer_price_components_money_shape" CHECK (("offer_price_components"."amount_kind" = 'known' and "offer_price_components"."amount_cents" is not null and "offer_price_components"."unknown_reason" is null)
       or ("offer_price_components"."amount_kind" = 'unknown' and "offer_price_components"."amount_cents" is null and "offer_price_components"."unknown_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "retention_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_class" "retention_data_class" NOT NULL,
	"sweep_run_id" text NOT NULL,
	"search_id" text,
	"deleted_count" integer NOT NULL,
	"trigger" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_brands" ADD COLUMN "approved_link_hosts" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_brands" ADD COLUMN "technologies" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_aliases" ADD CONSTRAINT "provider_aliases_provider_id_provider_brands_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_health" ADD CONSTRAINT "provider_health_provider_id_provider_brands_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_markets" ADD CONSTRAINT "provider_markets_provider_id_provider_brands_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_markets" ADD CONSTRAINT "provider_markets_market_id_launch_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."launch_markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_attempts" ADD CONSTRAINT "qualification_attempts_job_id_qualification_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."qualification_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_attempts" ADD CONSTRAINT "qualification_attempts_evidence_id_evidence_records_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_jobs" ADD CONSTRAINT "qualification_jobs_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_jobs" ADD CONSTRAINT "qualification_jobs_provider_id_provider_brands_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_address_material" ADD CONSTRAINT "search_address_material_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD CONSTRAINT "search_candidates_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD CONSTRAINT "search_candidates_provider_id_provider_brands_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_market_id_launch_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."launch_markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_offers" ADD CONSTRAINT "address_offers_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_offers" ADD CONSTRAINT "address_offers_provider_id_provider_brands_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_offers" ADD CONSTRAINT "address_offers_job_id_qualification_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."qualification_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_offers" ADD CONSTRAINT "address_offers_evidence_id_evidence_records_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_plans" ADD CONSTRAINT "catalog_plans_provider_id_provider_brands_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_plans" ADD CONSTRAINT "catalog_plans_evidence_id_evidence_records_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_conditions" ADD CONSTRAINT "offer_conditions_offer_id_address_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."address_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_price_components" ADD CONSTRAINT "offer_price_components_offer_id_address_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."address_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_aliases_unique_per_source" ON "provider_aliases" USING btree ("kind","source_type","value_normalized");--> statement-breakpoint
CREATE INDEX "provider_aliases_provider_idx" ON "provider_aliases" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "evidence_records_retrieved_idx" ON "evidence_records" USING btree ("retrieved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "qualification_attempts_unique" ON "qualification_attempts" USING btree ("job_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "qualification_jobs_idempotency" ON "qualification_jobs" USING btree ("search_id","provider_id","adapter_version");--> statement-breakpoint
CREATE INDEX "qualification_jobs_search_idx" ON "qualification_jobs" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "search_address_material_expires_idx" ON "search_address_material" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "search_candidates_unique" ON "search_candidates" USING btree ("search_id","provider_id","evidence_class");--> statement-breakpoint
CREATE INDEX "search_candidates_search_idx" ON "search_candidates" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "searches_expires_at_idx" ON "searches" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "searches_state_idx" ON "searches" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "address_offers_idempotency" ON "address_offers" USING btree ("search_id","provider_id","adapter_version","offer_key");--> statement-breakpoint
CREATE INDEX "address_offers_search_idx" ON "address_offers" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "address_offers_expires_idx" ON "address_offers" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "address_offers_identity_idx" ON "address_offers" USING btree ("address_identity");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_plans_unique" ON "catalog_plans" USING btree ("provider_id","plan_key","parser_version");--> statement-breakpoint
CREATE INDEX "catalog_plans_expires_idx" ON "catalog_plans" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_conditions_unique" ON "offer_conditions" USING btree ("offer_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_price_components_unique" ON "offer_price_components" USING btree ("offer_id","position");--> statement-breakpoint
CREATE INDEX "retention_events_occurred_idx" ON "retention_events" USING btree ("occurred_at");