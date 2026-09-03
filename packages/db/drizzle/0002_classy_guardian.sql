CREATE TABLE "launch_registry_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registry_version" text NOT NULL,
	"status" text NOT NULL,
	"document" jsonb NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "launch_registry_documents_version" ON "launch_registry_documents" USING btree ("registry_version");--> statement-breakpoint
CREATE UNIQUE INDEX "launch_registry_documents_one_active" ON "launch_registry_documents" USING btree ("active") WHERE "launch_registry_documents"."active" = true;