-- CreateEnum
CREATE TYPE "CodeOrigin" AS ENUM ('physical', 'digital');

-- CreateEnum
CREATE TYPE "CodeStatus" AS ENUM ('unused', 'used');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'failed');

-- CreateTable
CREATE TABLE "codes" (
    "id" TEXT NOT NULL,
    "code_value" TEXT NOT NULL,
    "origin" "CodeOrigin" NOT NULL,
    "status" "CodeStatus" NOT NULL DEFAULT 'unused',
    "max_downloads" INTEGER NOT NULL DEFAULT 1,
    "downloads_used" INTEGER NOT NULL DEFAULT 0,
    "batch_label" TEXT,
    "redeemed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "sumup_checkout_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "code_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "codes_code_value_key" ON "codes"("code_value");

-- CreateIndex
CREATE UNIQUE INDEX "orders_sumup_checkout_id_key" ON "orders"("sumup_checkout_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_id_key" ON "orders"("code_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
