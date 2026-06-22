-- Create content_schedules and notifications tables
CREATE TABLE IF NOT EXISTS "content_schedules" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "creator_id" uuid NOT NULL,
  "tier_id" uuid NOT NULL,
  "content_url" text NOT NULL,
  "available_at" timestamptz NOT NULL,
  "active" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "fan_id" uuid NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "data" jsonb,
  "read" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "content_schedules" ADD CONSTRAINT fk_content_schedules_creator FOREIGN KEY ("creator_id") REFERENCES "creators" ("id") ON DELETE CASCADE;
ALTER TABLE "content_schedules" ADD CONSTRAINT fk_content_schedules_tier FOREIGN KEY ("tier_id") REFERENCES "tiers" ("id");
ALTER TABLE "notifications" ADD CONSTRAINT fk_notifications_fan FOREIGN KEY ("fan_id") REFERENCES "fans" ("id") ON DELETE CASCADE;
