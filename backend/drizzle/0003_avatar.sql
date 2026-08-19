-- Custom SQL migration file, put your code below! --
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "avatar_url" text;
