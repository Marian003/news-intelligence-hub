ALTER TYPE "public"."llm_operation" ADD VALUE 'entity_match';--> statement-breakpoint
CREATE TABLE "entity_alias_keys" (
	"user_id" uuid NOT NULL,
	"type" "entity_type" NOT NULL,
	"alias_key" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_alias_keys_user_id_type_alias_key_pk" PRIMARY KEY("user_id","type","alias_key")
);
--> statement-breakpoint
ALTER TABLE "entity_alias_keys" ADD CONSTRAINT "entity_alias_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_alias_keys" ADD CONSTRAINT "entity_alias_keys_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entity_alias_keys_entity_idx" ON "entity_alias_keys" USING btree ("entity_id");