-- CreateTable
CREATE TABLE `Tag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_TagToUgc` (
    `A` INTEGER NOT NULL,
    `B` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `_TagToUgc_AB_unique`(`A`, `B`),
    INDEX `_TagToUgc_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_TagToUgc` ADD CONSTRAINT `_TagToUgc_A_fkey` FOREIGN KEY (`A`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TagToUgc` ADD CONSTRAINT `_TagToUgc_B_fkey` FOREIGN KEY (`B`) REFERENCES `Ugc`(`assetId`) ON DELETE CASCADE ON UPDATE CASCADE;
