CREATE TYPE "public"."article_status" AS ENUM('pending', 'processing', 'processed', 'filtered', 'failed');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feed_id" uuid NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"content_hash" text NOT NULL,
	"guid" text,
	"title" text NOT NULL,
	"author" text,
	"content" text,
	"published_at" timestamp with time zone,
	"status" "article_status" DEFAULT 'pending' NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_user_url_unique" UNIQUE("user_id","normalized_url")
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_user_idx" ON "articles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "articles_feed_idx" ON "articles" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "articles_user_hash_idx" ON "articles" USING btree ("user_id","content_hash");--> statement-breakpoint
CREATE INDEX "articles_user_status_idx" ON "articles" USING btree ("user_id","status");