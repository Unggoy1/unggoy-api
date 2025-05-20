/*
  Warnings:

  - You are about to drop the `_PlaylistToUgc` table. If the table is not empty, all the data it contains will be lost.

*/
-- Create a backup of the existing data
CREATE TABLE `_PlaylistToUgc_backup` AS SELECT * FROM `_PlaylistToUgc`;

-- DropForeignKey
ALTER TABLE `_PlaylistToUgc` DROP FOREIGN KEY `_PlaylistToUgc_A_fkey`;

-- DropForeignKey
ALTER TABLE `_PlaylistToUgc` DROP FOREIGN KEY `_PlaylistToUgc_B_fkey`;

-- CreateTable
CREATE TABLE `UgcPair` (
    `id` VARCHAR(191) NOT NULL,
    `playlistId` VARCHAR(191) NOT NULL,
    `mapAssetId` VARCHAR(191) NULL,
    `gamemodeAssetId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UgcPair_playlistId_idx`(`playlistId`),
    INDEX `UgcPair_mapAssetId_idx`(`mapAssetId`),
    INDEX `UgcPair_gamemodeAssetId_idx`(`gamemodeAssetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;

-- AddForeignKey
ALTER TABLE `UgcPair` ADD CONSTRAINT `UgcPair_playlistId_fkey` FOREIGN KEY (`playlistId`) REFERENCES `Playlist`(`assetId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UgcPair` ADD CONSTRAINT `UgcPair_mapAssetId_fkey` FOREIGN KEY (`mapAssetId`) REFERENCES `Ugc`(`assetId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UgcPair` ADD CONSTRAINT `UgcPair_gamemodeAssetId_fkey` FOREIGN KEY (`gamemodeAssetId`) REFERENCES `Ugc`(`assetId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing data - create separate entries for maps and gamemodes
-- Create entries for maps (assetKind = 2)
INSERT INTO `UgcPair` (`id`, `playlistId`, `mapAssetId`, `gamemodeAssetId`, `createdAt`)
SELECT 
    UUID() as id,
    pu.A as playlistId,
    pu.B as mapAssetId,
    NULL as gamemodeAssetId,
    NOW() as createdAt
FROM 
    `_PlaylistToUgc` pu
    JOIN `Ugc` u ON u.assetId = pu.B
WHERE u.assetKind = 2;

-- Create entries for gamemodes (assetKind = 6)
INSERT INTO `UgcPair` (`id`, `playlistId`, `mapAssetId`, `gamemodeAssetId`, `createdAt`)
SELECT 
    UUID() as id,
    pu.A as playlistId,
    NULL as mapAssetId,
    pu.B as gamemodeAssetId,
    NOW() as createdAt
FROM 
    `_PlaylistToUgc` pu
    JOIN `Ugc` u ON u.assetId = pu.B
WHERE u.assetKind = 6;

-- Create entries for any other UGC types (neither map nor gamemode)
-- You can adjust this based on your needs
INSERT INTO `UgcPair` (`id`, `playlistId`, `mapAssetId`, `gamemodeAssetId`, `createdAt`)
SELECT 
    UUID() as id,
    pu.A as playlistId,
    pu.B as mapAssetId,
    NULL as gamemodeAssetId,
    NOW() as createdAt
FROM 
    `_PlaylistToUgc` pu
    JOIN `Ugc` u ON u.assetId = pu.B
WHERE u.assetKind NOT IN (2, 6);

-- Drop the old join table
DROP TABLE `_PlaylistToUgc`;

-- Drop the backup table
DROP TABLE `_PlaylistToUgc_backup`;
