CREATE TYPE "public"."device_platform" AS ENUM('web', 'android', 'ios');--> statement-breakpoint
CREATE TYPE "public"."device_request_status" AS ENUM('pending', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "device_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"key_id" text NOT NULL,
	"platform" "device_platform" DEFAULT 'web' NOT NULL,
	"label" text,
	"user_agent" text,
	"ip" text,
	"status" "device_request_status" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"key_id" text NOT NULL,
	"platform" "device_platform" DEFAULT 'web' NOT NULL,
	"label" text,
	"user_agent" text,
	"status" "device_status" DEFAULT 'active' NOT NULL,
	"approved_by_id" uuid,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_id" uuid,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offline_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"lecture_id" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "device_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "proof_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "admin_unlocked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "device_requests" ADD CONSTRAINT "device_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_requests" ADD CONSTRAINT "device_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_revoked_by_id_users_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_licenses" ADD CONSTRAINT "offline_licenses_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_licenses" ADD CONSTRAINT "offline_licenses_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_requests_one_pending" ON "device_requests" USING btree ("user_id") WHERE "device_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "device_requests_status_idx" ON "device_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_one_active_per_user" ON "devices" USING btree ("user_id") WHERE "devices"."status" = 'active';--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "offline_licenses_device_idx" ON "offline_licenses" USING btree ("device_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- الجلسات القديمة غير مرتبطة بجهاز: تُلغى ويُطلب تسجيل الدخول من جديد.
DELETE FROM "sessions";
