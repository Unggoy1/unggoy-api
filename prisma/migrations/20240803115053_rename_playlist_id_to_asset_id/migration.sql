/*
  Warnings:

  - The primary key for the `Playlist` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Playlist` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[assetId]` on the table `Playlist` will be added. If there are existing duplicate values, this will fail.
  - The required column `assetId` was added to the `Playlist` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE `_PlaylistToUgc` DROP FOREIGN KEY `_PlaylistToUgc_A_fkey`;

-- DropIndex
DROP INDEX `Playlist_id_key` ON `Playlist`;

-- AlterTable: Rename column and update constraints
ALTER TABLE `Playlist` DROP PRIMARY KEY,
    CHANGE COLUMN `id` `assetId` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`assetId`);

-- CreateIndex
CREATE UNIQUE INDEX `Playlist_assetId_key` ON `Playlist`(`assetId`);

-- AddForeignKey
ALTER TABLE `_PlaylistToUgc` ADD CONSTRAINT `_PlaylistToUgc_A_fkey` FOREIGN KEY (`A`) REFERENCES `Playlist`(`assetId`) ON DELETE CASCADE ON UPDATE CASCADE;
