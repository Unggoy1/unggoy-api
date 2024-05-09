-- CreateTable
CREATE TABLE `Oauth` (
    `userId` VARCHAR(191) NOT NULL,
    `spartanToken` VARCHAR(191) NOT NULL,
    `spartanTokenExpiresAt` DATETIME(3) NOT NULL,
    `refreshToken` VARCHAR(191) NOT NULL,
    `refreshTokenExpiresAt` DATETIME(3) NOT NULL,

    INDEX `Oauth_userId_idx`(`userId`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;

-- AddForeignKey
ALTER TABLE `Oauth` ADD CONSTRAINT `Oauth_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
