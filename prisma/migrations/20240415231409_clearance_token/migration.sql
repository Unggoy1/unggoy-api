/*
  Warnings:

  - Added the required column `clearanceToken` to the `Oauth` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Oauth` ADD COLUMN `clearanceToken` VARCHAR(191) NOT NULL;
