-- Org isolation (CLAUDE.md: RLS + NestJS guard). The app role must NOT be superuser/BYPASSRLS.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_org_visible(row_org uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('app.bypass_rls', true), 'off') = 'on' OR row_org::text = current_setting('app.org_id', true) $$;
--> statement-breakpoint
ALTER TABLE "crm_contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_contacts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "crm_contacts_org_isolation" ON "crm_contacts" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "crm_pipelines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_pipelines" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "crm_pipelines_org_isolation" ON "crm_pipelines" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "crm_deals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_deals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "crm_deals_org_isolation" ON "crm_deals" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "crm_tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_tasks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "crm_tasks_org_isolation" ON "crm_tasks" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "crm_activities" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_activities" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "crm_activities_org_isolation" ON "crm_activities" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "crm_matches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_matches" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "crm_matches_org_isolation" ON "crm_matches" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "crm_viewings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_viewings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "crm_viewings_org_isolation" ON "crm_viewings" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "crm_sequences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_sequences" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "crm_sequences_org_isolation" ON "crm_sequences" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "crm_sequence_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_sequence_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "crm_sequence_runs_org_isolation" ON "crm_sequence_runs" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "crm_lead_sources" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_lead_sources" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "crm_lead_sources_org_isolation" ON "crm_lead_sources" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "crm_imports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_imports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "crm_imports_org_isolation" ON "crm_imports" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "presentations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "presentations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "presentations_org_isolation" ON "presentations" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "documents_org_isolation" ON "documents" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "competitor_tracks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "competitor_tracks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "competitor_tracks_org_isolation" ON "competitor_tracks" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "competitor_price_changes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "competitor_price_changes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "competitor_price_changes_org_isolation" ON "competitor_price_changes" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "owner_reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "owner_reports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "owner_reports_org_isolation" ON "owner_reports" USING (app_org_visible(org_id)) WITH CHECK (app_org_visible(org_id));
--> statement-breakpoint
ALTER TABLE "co_broker_shares" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "co_broker_shares" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "co_broker_shares_org_isolation" ON "co_broker_shares" USING (app_org_visible(from_org_id) OR app_org_visible(to_org_id)) WITH CHECK (app_org_visible(from_org_id));
