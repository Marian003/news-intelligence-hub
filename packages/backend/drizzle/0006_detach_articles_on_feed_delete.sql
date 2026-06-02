ALTER TABLE "articles" DROP CONSTRAINT "articles_feed_id_feeds_id_fk";
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "feed_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE set null ON UPDATE no action;