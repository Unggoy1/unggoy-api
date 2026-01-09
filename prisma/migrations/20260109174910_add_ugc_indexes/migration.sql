-- CreateIndex
CREATE INDEX `Ugc_assetKind_idx` ON `Ugc`(`assetKind`);

-- CreateIndex
CREATE INDEX `Ugc_recommended_idx` ON `Ugc`(`recommended`);

-- RenameIndex
ALTER TABLE `Ugc` RENAME INDEX `Ugc_authorId_fkey` TO `Ugc_authorId_idx`;
