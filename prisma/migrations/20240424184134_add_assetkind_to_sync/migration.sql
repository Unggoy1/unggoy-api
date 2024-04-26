/*
  Warnings:

  - Added the required column `assetKind` to the `WaypointSync` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `WaypointSync` ADD COLUMN `assetKind` ENUM('Map', 'Prefab', 'UgcGameVariant') NOT NULL;
