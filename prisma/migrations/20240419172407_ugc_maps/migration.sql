-- CreateTable
CREATE TABLE `Ugc` (
    `assetId` VARCHAR(36) NOT NULL,
    `versionId` VARCHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(256) NOT NULL,
    `assetKind` TINYINT UNSIGNED NOT NULL,
    `thumbnailUrl` VARCHAR(255) NOT NULL,
    `favorites` INTEGER UNSIGNED NOT NULL,
    `likes` INTEGER UNSIGNED NOT NULL,
    `bookmarks` INTEGER UNSIGNED NOT NULL,
    `playsRecent` INTEGER UNSIGNED NOT NULL,
    `playsAllTime` INTEGER UNSIGNED NOT NULL,
    `averageRaing` TINYINT UNSIGNED NOT NULL,
    `numberOfRatings` INTEGER UNSIGNED NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL,
    `hasNodeGraph` BOOLEAN NOT NULL,
    `readOnlyClones` TINYINT UNSIGNED NOT NULL,
    `numberOfObjects` INTEGER UNSIGNED NULL,
    `tags` JSON NULL,
    `files` JSON NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Ugc_assetId_key`(`assetId`),
    UNIQUE INDEX `Ugc_versionId_key`(`versionId`),
    PRIMARY KEY (`assetId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contributor` (
    `xuid` VARCHAR(191) NOT NULL,
    `gamertag` VARCHAR(191) NOT NULL,
    `serviceTag` VARCHAR(4) NOT NULL,
    `emblemId` INTEGER NOT NULL,

    UNIQUE INDEX `Contributor_xuid_key`(`xuid`),
    UNIQUE INDEX `Contributor_gamertag_key`(`gamertag`),
    UNIQUE INDEX `Contributor_emblemId_key`(`emblemId`),
    PRIMARY KEY (`xuid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ContributorToUgc` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `_ContributorToUgc_AB_unique`(`A`, `B`),
    INDEX `_ContributorToUgc_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_ContributorToUgc` ADD CONSTRAINT `_ContributorToUgc_A_fkey` FOREIGN KEY (`A`) REFERENCES `Contributor`(`xuid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ContributorToUgc` ADD CONSTRAINT `_ContributorToUgc_B_fkey` FOREIGN KEY (`B`) REFERENCES `Ugc`(`assetId`) ON DELETE CASCADE ON UPDATE CASCADE;
