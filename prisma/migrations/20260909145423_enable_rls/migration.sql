-- Enable Row Level Security so these tables are not publicly readable/writable
-- via Supabase's auto-generated Data API (anon key). The app itself connects
-- as the `postgres` role, which bypasses RLS, so this has no effect on Prisma.
ALTER TABLE "codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
