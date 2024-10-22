# Unggoy Api

[Discord Server](https://discord.gg/xnwFA4z2HA)

The backend service for Unggoy Web which is a website to browse Halo Infinite user generated content, and create playlists out of the UGC.

## Requirements

- [Bun js runtime](https://bun.sh/)
- [Microsoft Entra Id project](https://entra.microsoft.com)
- S3 Storage or local alternative such as [MinIO](https://github.com/minio/minio)
- Docker (for running tests only)

## Run Locally

Clone the project

Go to the project directory

Install dependencies

```bash
  bun install
```

Run the database migrations

```bash
  bunx prisma migrate dev
```

Start the server

```bash
  bun run dev
```

To get login actions working you need to provide your own xbox spartan token. You can look at the code in [auth.ts](https://github.com/Unggoy1/unggoy-api/blob/main/src/auth.ts) and [authTools.ts](https://github.com/Unggoy1/unggoy-api/blob/main/src/authTools.ts) to see how i programatically got my tokens.
You will need to manually enter the following into the Oauth table in your development database:

- userId
- spartanToken
- spartanTokenExpiresAt
- refreshToken(microsoft account)
- clearanceToken

Also the userId needs to be added in your .env file as `OAUTH_USER="userId"`

## Environment Variables

To run this project, you will need to add environment variables to your .env file. Check out the `dev.env` file for all the required variables

OAUTH_USER is the user id from the database of your development user you manually inject into the database

## Running Tests

_Current test run, but are not finished to fully test all endopinds and input combindations_

Tests require Docker to work.
To run tests, run the following command

```bash
  bun run test
```

After you are done with testing run the following to stop the testing container

```bash
  bun run docker:down
```

Plans for individual unit tests with mocks instead of an actual database and S3 instance are planned for v1.0 release.

## Contributing

Contributions are always welcome!
Come chat on Discord before contributing to make sure im not already working on something similar

## Support

For issues report them on the repos issues page. For suggestions or other things ask around on the Discord
