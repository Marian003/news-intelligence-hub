-- article_entities now requires a resolved entity_id. Existing mention rows are
-- derived data (regenerated when articles are reprocessed), so clear them before
-- adding the NOT NULL column. No-op on a fresh database.
DELETE FROM "article_entities";--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_name" text NOT NULL,
	"normalized_key" text NOT NULL,
	"type" "entity_type" NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_user_type_key_unique" UNIQUE("user_id","type","normalized_key")
);
--> statement-breakpoint
ALTER TABLE "article_entities" ADD COLUMN "entity_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entities_user_idx" ON "entities" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "article_entities" ADD CONSTRAINT "article_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_entities_entity_idx" ON "article_entities" USING btree ("entity_id");