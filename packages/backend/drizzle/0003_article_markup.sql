CREATE TYPE "public"."entity_type" AS ENUM('person', 'company', 'product', 'technology', 'location');--> statement-breakpoint
CREATE TYPE "public"."importance_level" AS ENUM('high', 'normal', 'junk');--> statement-breakpoint
CREATE TYPE "public"."llm_operation" AS ENUM('processing', 'regeneration', 'digest');--> statement-breakpoint
CREATE TABLE "article_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "entity_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_cache" (
	"content_hash" text PRIMARY KEY NOT NULL,
	"result" jsonb NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"article_id" uuid,
	"operation" "llm_operation" NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "importance" "importance_level";--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "article_entities" ADD CONSTRAINT "article_entities_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_entities" ADD CONSTRAINT "article_entities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage" ADD CONSTRAINT "llm_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_entities_article_idx" ON "article_entities" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "article_entities_user_idx" ON "article_entities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "llm_usage_operation_idx" ON "llm_usage" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "llm_usage_user_idx" ON "llm_usage" USING btree ("user_id");