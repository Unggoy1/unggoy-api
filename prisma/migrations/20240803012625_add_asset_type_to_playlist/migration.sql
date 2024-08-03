/*
  Warnings:

  - You are about to drop the column `thumbnail` on the `Playlist` table. All the data in the column will be lost.
  - Added the required column `thumbnailUrl` to the `Playlist` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Playlist` RENAME COLUMN `thumbnail` to `thumbnailUrl`,
    ADD COLUMN `assetKind` TINYINT UNSIGNED NOT NULL DEFAULT 5;
