-- CreateTable
CREATE TABLE `Playlist` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `thumbnail` VARCHAR(191) NOT NULL,
    `private` BOOLEAN NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Playlist_id_key`(`id`),
    INDEX `Playlist_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;

-- CreateTable
CREATE TABLE `_PlaylistToUgc` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `_PlaylistToUgc_AB_unique`(`A`, `B`),
    INDEX `_PlaylistToUgc_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;

-- AddForeignKey
ALTER TABLE `Playlist` ADD CONSTRAINT `Playlist_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PlaylistToUgc` ADD CONSTRAINT `_PlaylistToUgc_A_fkey` FOREIGN KEY (`A`) REFERENCES `Playlist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PlaylistToUgc` ADD CONSTRAINT `_PlaylistToUgc_B_fkey` FOREIGN KEY (`B`) REFERENCES `Ugc`(`assetId`) ON DELETE CASCADE ON UPDATE CASCADE;
