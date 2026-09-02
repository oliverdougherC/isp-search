CREATE TYPE "public"."adapter_support_state" AS ENUM('reference', 'link_only', 'disabled');--> statement-breakpoint
CREATE TABLE "provider_brands" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"legal_entity" text,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"official_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"adapter_support" "adapter_support_state" DEFAULT 'link_only' NOT NULL,
	"integration_tier" text,
	"terms_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_brands_id_slug" CHECK ("provider_brands"."id" ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);
--> statement-breakpoint
CREATE INDEX "provider_brands_adapter_support_idx" ON "provider_brands" USING btree ("adapter_support");