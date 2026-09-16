ALTER TABLE "districts" ADD COLUMN "avg_price_m2_override_minor" integer;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD COLUMN "contract_url" text;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD COLUMN "esign_ref" text;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD COLUMN "tenant_signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD COLUMN "owner_signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD COLUMN "invoice_id" uuid;