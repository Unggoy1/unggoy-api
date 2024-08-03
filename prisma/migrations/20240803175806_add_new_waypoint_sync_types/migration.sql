-- AlterTable
ALTER TABLE `WaypointSync` MODIFY `assetKind` ENUM('Map', 'Prefab', 'UgcGameVariant', 'Recommended343', 'MapDeleted', 'PrefabDeleted', 'UgcGameVariantDeleted') NOT NULL;
