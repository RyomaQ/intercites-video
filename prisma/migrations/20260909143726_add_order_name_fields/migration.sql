/*
  Warnings:

  - Added the required column `first_name` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT;

-- Backfill existing test rows (created before name capture existed)
UPDATE "orders" SET "first_name" = 'Unknown', "last_name" = 'Unknown' WHERE "first_name" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "first_name" SET NOT NULL,
ALTER COLUMN "last_name" SET NOT NULL;
