CREATE TABLE IF NOT EXISTS "kv" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kv_expires_idx" ON "kv" USING btree ("expires_at");