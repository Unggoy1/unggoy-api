-- AlterTable
ALTER TABLE `Playlist` ADD COLUMN `hasCustomThumbnail` BOOLEAN NOT NULL DEFAULT false;

-- Backfill: before this feature every non-placeholder thumbnail was a user upload,
-- so flag those as custom to keep auto-generation from overwriting them.
UPDATE `Playlist`
SET `hasCustomThumbnail` = true
WHERE `thumbnailUrl` IS NOT NULL
  AND `thumbnailUrl` != ''
  AND `thumbnailUrl` != '/placeholder.webp';
