-- Worker.phone: required unique → optional unique
-- Worker.email: optional → optional unique
-- Worker.jobTitle: required → required with default

ALTER TABLE "workers" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "workers" ALTER COLUMN "jobTitle" SET DEFAULT '미설정';

-- email unique index (nullable unique — nulls don't conflict in PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS "workers_email_key" ON "workers"("email");
