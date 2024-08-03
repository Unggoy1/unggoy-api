/*
  Warnings:

  - Added the required column `serviceTag` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `User` ADD COLUMN `emblemPath` VARCHAR(191) NULL,
    ADD COLUMN `serviceTag` VARCHAR(4) NOT NULL;
