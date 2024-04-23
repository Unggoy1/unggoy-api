/*
  Warnings:

  - You are about to drop the column `emblemId` on the `Contributor` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `Contributor_emblemId_key` ON `Contributor`;

-- AlterTable
ALTER TABLE `Contributor` DROP COLUMN `emblemId`;
