CREATE TYPE "public"."digest_period" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TYPE "public"."digest_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" "digest_period" NOT NULL,
	"status" "digest_status" DEFAULT 'pending' NOT NULL,
	"category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "digests" ADD CONSTRAINT "digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "digests_user_idx" ON "digests" USING btree ("user_id");