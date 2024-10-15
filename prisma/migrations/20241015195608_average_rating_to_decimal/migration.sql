/*
  Warnings:

  - Changed the type of `averageRating` on the `Ugc` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE `Ugc` modify COLUMN `averageRating` DECIMAL(3, 2) NOT NULL;
