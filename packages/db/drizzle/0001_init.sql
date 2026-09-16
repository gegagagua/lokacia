CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"path" text,
	"session_hash" text,
	"props" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"actor_id" uuid,
	"org_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"diff" jsonb,
	"ip" text,
	"impersonator_id" uuid
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid,
	"kind" text NOT NULL,
	"granted" boolean NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid,
	"app" text DEFAULT 'web' NOT NULL,
	"path" text,
	"rating" integer,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"invited_phone" text,
	"role" text DEFAULT 'agent' NOT NULL,
	"district_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"accepted_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"to" text,
	"title" text,
	"body" text,
	"link" text,
	"payload" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"logo_url" text,
	"about" text,
	"phone" text,
	"email" text,
	"address" text,
	"website" text,
	"brand_color" text,
	"lead_distribution" text DEFAULT 'round_robin' NOT NULL,
	"rr_cursor" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_id" uuid,
	"user_agent" text,
	"ip" text,
	"impersonator_id" uuid
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tenant_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"activity" text,
	"business_type" text,
	"company_name" text,
	"experience_years" integer,
	"desired_term_months" integer,
	"employees" integer,
	"website" text,
	"about" text,
	CONSTRAINT "tenant_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"phone" text,
	"email" text,
	"name" text,
	"role" text DEFAULT 'user' NOT NULL,
	"avatar_url" text,
	"verified_at" timestamp with time zone,
	"locale" text DEFAULT 'ka' NOT NULL,
	"google_id" text,
	"banned_at" timestamp with time zone,
	"ban_reason" text,
	"telegram_chat_id" text,
	"viber_id" text,
	"telegram_link_token" text,
	"notification_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"consent_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"slug" text,
	"bio" text
);
--> statement-breakpoint
CREATE TABLE "business_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"slug" text NOT NULL,
	"name_ka" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ru" text NOT NULL,
	"icon" text DEFAULT 'store' NOT NULL,
	"filter_config" jsonb NOT NULL,
	"utility_coef" numeric(8, 2) DEFAULT 3 NOT NULL,
	"fitout_per_m2_minor" integer DEFAULT 30000 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "business_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cms_pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"business_type_id" uuid,
	"locale" text DEFAULT 'ka' NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "districts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"city" text DEFAULT 'tbilisi' NOT NULL,
	"slug" text NOT NULL,
	"name_ka" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ru" text NOT NULL,
	"boundary" jsonb NOT NULL,
	"geom" geography(MultiPolygon,4326) GENERATED ALWAYS AS (ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(boundary::text), 4326))::geography) STORED,
	"center_lat" double precision NOT NULL,
	"center_lng" double precision NOT NULL,
	"avg_price_m2_minor" integer DEFAULT 0 NOT NULL,
	"avg_sale_price_m2_minor" integer DEFAULT 0 NOT NULL,
	"active_count" integer DEFAULT 0 NOT NULL,
	"vacancy_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"price_minor" integer,
	"booked_by_id" uuid,
	"booked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"business_name" text NOT NULL,
	"business_type" text,
	"started_at" date NOT NULL,
	"ended_at" date,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "listing_media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid,
	"uploader_id" uuid,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"variants" jsonb,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_floorplan" boolean DEFAULT false NOT NULL,
	"width" integer,
	"height" integer,
	"status" text DEFAULT 'ready' NOT NULL,
	"alt" text
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid,
	"owner_id" uuid NOT NULL,
	"agent_id" uuid,
	"project_id" uuid,
	"slug" text NOT NULL,
	"business_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"deal_type" text NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" text DEFAULT 'GEL' NOT NULL,
	"price_period" text DEFAULT 'month' NOT NULL,
	"price_hour_minor" integer,
	"price_day_minor" integer,
	"service_fee_minor" integer DEFAULT 0 NOT NULL,
	"deposit_months" numeric(4, 1) DEFAULT 1 NOT NULL,
	"utilities_included" boolean DEFAULT false NOT NULL,
	"equipment_price_minor" integer,
	"area_m2" numeric(10, 2) NOT NULL,
	"floor" integer,
	"floors_total" integer,
	"commission_pct" numeric(5, 2),
	"is_owner" boolean DEFAULT true NOT NULL,
	"verified_owner" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reject_reason" text,
	"last_confirmed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"completion_date" date,
	"district_id" uuid,
	"city" text DEFAULT 'tbilisi' NOT NULL,
	"address" text NOT NULL,
	"title" text NOT NULL,
	"title_en" text,
	"title_ru" text,
	"description" text DEFAULT '' NOT NULL,
	"description_en" text,
	"description_ru" text,
	"vip_until" timestamp with time zone,
	"video_url" text,
	"tour_url" text,
	"location_score" integer,
	"lat" double precision,
	"lng" double precision,
	"geom" geography(Point,4326) GENERATED ALWAYS AS (CASE WHEN lat IS NULL OR lng IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography END) STORED
);
--> statement-breakpoint
CREATE TABLE "liveness_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"token" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"result" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"document_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "prebookings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"project_id" uuid,
	"user_id" uuid NOT NULL,
	"message" text,
	"phone" text,
	"status" text DEFAULT 'requested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address" text NOT NULL,
	"district_id" uuid,
	"completion_date" date NOT NULL,
	"description" text,
	"floors" integer,
	"cover_url" text,
	"lat" double precision,
	"lng" double precision,
	"geom" geography(Point,4326) GENERATED ALWAYS AS (CASE WHEN lat IS NULL OR lng IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography END) STORED,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "space_passports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"power_kw" numeric(8, 2),
	"three_phase" boolean,
	"ceiling_m" numeric(5, 2),
	"facade_m" numeric(6, 2),
	"width_m" numeric(6, 2),
	"depth_m" numeric(6, 2),
	"has_hood" boolean,
	"has_gas" boolean,
	"wet_points" integer,
	"gate_w_m" numeric(5, 2),
	"truck_access" boolean,
	"access_24_7" boolean,
	"parking" integer,
	"shop_window" boolean,
	"separate_entrance" boolean,
	"ventilation" boolean,
	"outline" jsonb,
	CONSTRAINT "space_passports_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
CREATE TABLE "transfer_equipment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"name" text NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"price_minor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compare_lists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"name" text DEFAULT 'შედარება' NOT NULL,
	"listing_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"share_token" text NOT NULL,
	CONSTRAINT "compare_lists_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid,
	"listing_id" uuid,
	"contact_id" uuid,
	"participant_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"channel" text DEFAULT 'portal' NOT NULL,
	"external_id" text,
	"subject" text,
	"last_message_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "demand_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"business_type" text NOT NULL,
	"deal_type" text DEFAULT 'rent' NOT NULL,
	"area_min" integer,
	"area_max" integer,
	"budget_minor" integer,
	"district_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"contact_phone" text,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "listing_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"type" text NOT NULL,
	"user_id" uuid,
	"ip_hash" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_stats_daily" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"reveals" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_scores" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"business_type" text NOT NULL,
	"score" integer NOT NULL,
	"components" jsonb NOT NULL,
	"summary" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid,
	"external_sender" text,
	"direction" text DEFAULT 'out' NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"parent_offer_id" uuid,
	"root_offer_id" uuid,
	"price_minor" integer NOT NULL,
	"term_months" integer NOT NULL,
	"free_months" integer DEFAULT 0 NOT NULL,
	"indexation_pct" integer DEFAULT 0 NOT NULL,
	"fitout_paid_by" text DEFAULT 'tenant' NOT NULL,
	"equipment_included" boolean DEFAULT false NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"contract_url" text
);
--> statement-breakpoint
CREATE TABLE "pois" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"category" text NOT NULL,
	"business_type" text,
	"name" text NOT NULL,
	"source" text DEFAULT 'osm' NOT NULL,
	"source_id" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"geom" geography(Point,4326) GENERATED ALWAYS AS (CASE WHEN lat IS NULL OR lng IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography END) STORED
);
--> statement-breakpoint
CREATE TABLE "report_purchases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"district_id" uuid,
	"business_type" text,
	"product_key" text NOT NULL,
	"invoice_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"url" text,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"body" text
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"channels" text[] DEFAULT '{email}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"last_notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"provider_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"listing_id" uuid,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"quote_minor" integer,
	"quote_note" text,
	"amount_minor" integer,
	"commission_pct" integer DEFAULT 10 NOT NULL,
	"commission_minor" integer,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "service_providers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"about" text,
	"logo_url" text,
	"phone" text,
	"city" text DEFAULT 'tbilisi' NOT NULL,
	"price_from" text,
	"rating_x10" integer DEFAULT 0 NOT NULL,
	"reviews_count" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"portfolio" jsonb,
	CONSTRAINT "service_providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "traffic_samples" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"district_id" uuid,
	"listing_id" uuid,
	"provider" text DEFAULT 'mock' NOT NULL,
	"weekday" integer NOT NULL,
	"hour" integer NOT NULL,
	"count" integer NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"geom" geography(Point,4326) GENERATED ALWAYS AS (CASE WHEN lat IS NULL OR lng IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography END) STORED
);
--> statement-breakpoint
CREATE TABLE "viewings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"slot_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"mode" text DEFAULT 'onsite' NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"video_url" text,
	"note" text,
	"reminded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "co_broker_shares" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"from_org_id" uuid NOT NULL,
	"to_org_id" uuid NOT NULL,
	"split_pct" numeric(5, 2) NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "competitor_price_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"old_price_minor" integer,
	"new_price_minor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_tracks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"listing_id" uuid,
	"url" text NOT NULL,
	"portal" text NOT NULL,
	"last_price_minor" integer,
	"last_checked_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"type" text DEFAULT 'client' NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"phones" text[] DEFAULT '{}'::text[] NOT NULL,
	"emails" text[] DEFAULT '{}'::text[] NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" text,
	"requirements" jsonb,
	"owner_agent_id" uuid,
	"notes" text,
	"merged_into_id" uuid,
	"portal_token" text,
	"last_contacted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_deals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"listing_id" uuid,
	"title" text NOT NULL,
	"stage" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"value_minor" integer DEFAULT 0 NOT NULL,
	"commission_pct" numeric(5, 2) DEFAULT 10 NOT NULL,
	"commission_minor" integer DEFAULT 0 NOT NULL,
	"agent_id" uuid,
	"agent_share_pct" numeric(5, 2) DEFAULT 50 NOT NULL,
	"source" text,
	"lost_reason" text,
	"expected_close_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_imports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"created_by" uuid,
	"file_name" text NOT NULL,
	"mapping" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rows_total" integer DEFAULT 0 NOT NULL,
	"rows_imported" integer DEFAULT 0 NOT NULL,
	"errors" jsonb
);
--> statement-breakpoint
CREATE TABLE "crm_lead_sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"monthly_cost_minor" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"client_comment" text,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_pipelines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"stages" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_sequence_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"deal_id" uuid,
	"step" integer DEFAULT 0 NOT NULL,
	"next_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_sequences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"steps" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid,
	"title" text NOT NULL,
	"due_at" timestamp with time zone,
	"assignee_id" uuid,
	"priority" text DEFAULT 'normal' NOT NULL,
	"done_at" timestamp with time zone,
	"reminded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_viewings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"contact_id" uuid,
	"listing_id" uuid,
	"deal_id" uuid,
	"agent_id" uuid,
	"title" text NOT NULL,
	"address" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"route_order" integer,
	"google_event_id" text,
	"lat" double precision,
	"lng" double precision,
	"geom" geography(Point,4326) GENERATED ALWAYS AS (CASE WHEN lat IS NULL OR lng IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography END) STORED
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid,
	"parent_id" uuid,
	"template" text NOT NULL,
	"title" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" jsonb,
	"url" text,
	"sign_status" text DEFAULT 'draft' NOT NULL,
	"sign_provider" text,
	"sign_ref" text,
	"signed_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "owner_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"week_start" text NOT NULL,
	"payload" jsonb NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "presentations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"created_by" uuid,
	"contact_id" uuid,
	"title" text NOT NULL,
	"message" text,
	"listing_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"token" text NOT NULL,
	"opened_at" timestamp with time zone,
	"open_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "presentations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"plan_key" text DEFAULT 'api_basic' NOT NULL,
	"rate_limit_per_min" integer DEFAULT 60 NOT NULL,
	"monthly_quota" integer DEFAULT 10000 NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"api_key_id" uuid NOT NULL,
	"day" date NOT NULL,
	"endpoint" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escrow_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"offer_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'mock' NOT NULL,
	"provider_ref" text,
	"dispute_reason" text,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_applications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"listing_id" uuid,
	"amount_minor" integer NOT NULL,
	"term_months" integer,
	"consent_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"partner_ref" text,
	"commission_minor" integer,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "finance_products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"partner" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"rate_text" text,
	"min_amount_minor" integer,
	"max_amount_minor" integer,
	"commission_pct" numeric(5, 2) DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"currency" text NOT NULL,
	"day" date NOT NULL,
	"rate_x10000" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"number" text NOT NULL,
	"org_id" uuid,
	"user_id" uuid,
	"subscription_id" uuid,
	"purpose" text NOT NULL,
	"ref_id" uuid,
	"lines" jsonb NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'GEL' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"pdf_url" text
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"tenant_id" uuid,
	"tenant_name" text NOT NULL,
	"tenant_phone" text,
	"offer_id" uuid,
	"rent_minor" integer NOT NULL,
	"day_of_month" integer DEFAULT 1 NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"penalty_pct_per_day" numeric(5, 2) DEFAULT 0.1 NOT NULL,
	"autopay" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"tx_id" uuid NOT NULL,
	"account" text NOT NULL,
	"debit_minor" integer DEFAULT 0 NOT NULL,
	"credit_minor" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'GEL' NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" uuid,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "maintenance_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"lease_id" uuid NOT NULL,
	"reporter_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"invoice_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"checkout_url" text,
	"raw" jsonb,
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"key" text NOT NULL,
	"name_ka" text NOT NULL,
	"audience" text NOT NULL,
	"kind" text NOT NULL,
	"price_minor" integer NOT NULL,
	"days" integer,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "plans_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "rent_invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"lease_id" uuid NOT NULL,
	"period" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"penalty_minor" integer DEFAULT 0 NOT NULL,
	"due_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"paid_at" timestamp with time zone,
	"invoice_id" uuid,
	"late_notice_sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"listing_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"format" text NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"plan" jsonb
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"org_id" uuid,
	"user_id" uuid,
	"plan_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"grace_until" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"downgraded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "utility_readings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"lease_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"period" text NOT NULL,
	"reading" numeric(12, 2),
	"amount_minor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "analytics_name_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_log" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_org_user_uq" ON "memberships" USING btree ("org_id","user_id") WHERE "memberships"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "memberships_phone_idx" ON "memberships" USING btree ("invited_phone");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_codes" USING btree ("phone","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_uq" ON "users" USING btree ("phone") WHERE "users"."phone" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email") WHERE "users"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_slug_uq" ON "users" USING btree ("slug") WHERE "users"."slug" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_uq" ON "users" USING btree ("google_id") WHERE "users"."google_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cms_kind_slug_locale_uq" ON "cms_pages" USING btree ("kind","slug","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "districts_city_slug_uq" ON "districts" USING btree ("city","slug");--> statement-breakpoint
CREATE INDEX "districts_geom_gist" ON "districts" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "slots_listing_idx" ON "availability_slots" USING btree ("listing_id","starts_at");--> statement-breakpoint
CREATE INDEX "media_listing_idx" ON "listing_media" USING btree ("listing_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_slug_uq" ON "listings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "listings_geom_gist" ON "listings" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "listings_business_types_gin" ON "listings" USING gin ("business_types");--> statement-breakpoint
CREATE INDEX "listings_status_district_deal_idx" ON "listings" USING btree ("status","district_id","deal_type");--> statement-breakpoint
CREATE INDEX "listings_owner_idx" ON "listings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "listings_org_idx" ON "listings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "listings_price_idx" ON "listings" USING btree ("price_minor");--> statement-breakpoint
CREATE INDEX "listings_title_trgm" ON "listings" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "listings_address_trgm" ON "listings" USING gin ("address" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "liveness_token_uq" ON "liveness_checks" USING btree ("token");--> statement-breakpoint
CREATE INDEX "liveness_listing_idx" ON "liveness_checks" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "projects_geom_gist" ON "projects" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "conversations_participants_gin" ON "conversations" USING gin ("participant_ids");--> statement-breakpoint
CREATE INDEX "conversations_org_idx" ON "conversations" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_listing_uq" ON "favorites" USING btree ("user_id","listing_id");--> statement-breakpoint
CREATE INDEX "events_listing_at_idx" ON "listing_events" USING btree ("listing_id","at");--> statement-breakpoint
CREATE INDEX "events_type_ip_idx" ON "listing_events" USING btree ("type","ip_hash","at");--> statement-breakpoint
CREATE UNIQUE INDEX "stats_listing_day_uq" ON "listing_stats_daily" USING btree ("listing_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_listing_type_uq" ON "location_scores" USING btree ("listing_id","business_type");--> statement-breakpoint
CREATE INDEX "messages_conv_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "offers_listing_idx" ON "offers" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "offers_root_idx" ON "offers" USING btree ("root_offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pois_source_uq" ON "pois" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "pois_geom_gist" ON "pois" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "pois_category_idx" ON "pois" USING btree ("category","business_type");--> statement-breakpoint
CREATE INDEX "reviews_target_idx" ON "reviews" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "saved_searches_user_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "traffic_listing_idx" ON "traffic_samples" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "traffic_geom_gist" ON "traffic_samples" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "viewings_listing_idx" ON "viewings" USING btree ("listing_id","starts_at");--> statement-breakpoint
CREATE INDEX "viewings_user_idx" ON "viewings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "crm_activities_entity_idx" ON "crm_activities" USING btree ("org_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_org_idx" ON "crm_contacts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_name_trgm" ON "crm_contacts" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "crm_contacts_tags_gin" ON "crm_contacts" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "crm_contacts_phones_gin" ON "crm_contacts" USING gin ("phones");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_contacts_portal_token_uq" ON "crm_contacts" USING btree ("portal_token") WHERE "crm_contacts"."portal_token" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "crm_deals_org_stage_idx" ON "crm_deals" USING btree ("org_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_lead_sources_org_key_uq" ON "crm_lead_sources" USING btree ("org_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_matches_contact_listing_uq" ON "crm_matches" USING btree ("contact_id","listing_id");--> statement-breakpoint
CREATE INDEX "crm_seq_runs_next_idx" ON "crm_sequence_runs" USING btree ("status","next_at");--> statement-breakpoint
CREATE INDEX "crm_tasks_org_due_idx" ON "crm_tasks" USING btree ("org_id","due_at");--> statement-breakpoint
CREATE INDEX "crm_viewings_org_start_idx" ON "crm_viewings" USING btree ("org_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_key_day_ep_uq" ON "api_usage" USING btree ("api_key_id","day","endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_currency_day_uq" ON "fx_rates" USING btree ("currency","day");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_uq" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "ledger_tx_idx" ON "ledger_entries" USING btree ("tx_id");--> statement-breakpoint
CREATE INDEX "ledger_account_idx" ON "ledger_entries" USING btree ("account");--> statement-breakpoint
CREATE UNIQUE INDEX "rent_invoices_lease_period_uq" ON "rent_invoices" USING btree ("lease_id","period");--> statement-breakpoint
CREATE INDEX "subs_org_idx" ON "subscriptions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "subs_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_provider_event_uq" ON "webhook_events" USING btree ("provider","event_id");