/*
  Warnings:

  - You are about to drop the column `averageRaing` on the `Ugc` table. All the data in the column will be lost.
  - Added the required column `averageRating` to the `Ugc` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Ugc` DROP COLUMN `averageRaing`,
    ADD COLUMN `averageRating` TINYINT UNSIGNED NOT NULL;
