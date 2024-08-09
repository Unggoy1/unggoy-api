-- CreateTable
CREATE TABLE `_Favorites` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_Favorites_AB_unique`(`A`, `B`),
    INDEX `_Favorites_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;

-- AddForeignKey
ALTER TABLE `_Favorites` ADD CONSTRAINT `_Favorites_A_fkey` FOREIGN KEY (`A`) REFERENCES `Playlist`(`assetId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_Favorites` ADD CONSTRAINT `_Favorites_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
