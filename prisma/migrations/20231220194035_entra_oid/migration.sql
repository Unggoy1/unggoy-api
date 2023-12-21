/*
  Warnings:

  - A unique constraint covering the columns `[oid]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `oid` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `User` ADD COLUMN `oid` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_oid_key` ON `User`(`oid`);
