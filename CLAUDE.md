# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Installation and Setup
```bash
# Install dependencies
bun install

# Run database migrations
bunx prisma migrate dev

# Generate Prisma client
bunx prisma generate
```

### Development
```bash
# Start development server (with hot reload)
bun run dev

# Start production server
NODE_ENV=production bun src/index.ts
```

### Testing
```bash
# Start test containers and run tests
bun run test

# Tear down test containers
bun run docker:down

# Deploy migrations (used in test script)
bun run migrate:deploy
```

### Database
```bash
# Create a new migration
bunx prisma migrate dev --name <migration_name>

# Apply migrations
bunx prisma migrate deploy

# Open Prisma Studio (database UI)
bunx prisma studio
```

## Architecture Overview

### Technology Stack
- **Runtime**: Bun v1.2.4
- **Framework**: Elysia (Bun-first web framework)
- **Database**: MySQL with Prisma ORM
- **Authentication**: Lucia Auth with Microsoft Entra ID (Azure AD)
- **Storage**: S3-compatible storage (Backblaze B2 or MinIO)
- **Image Processing**: Sharp, TensorFlow.js (NSFW detection)
- **Testing**: Bun test with Docker for database isolation

### Project Structure
- `/src` - Application source code
  - `/routes` - API endpoint definitions grouped by resource
  - `/lib` - Shared utilities and error classes
  - `index.ts` - Main server entry point with route registration
  - `auth.ts` - Microsoft/Xbox authentication logic
  - `middleware.ts` - Authentication middleware using Lucia
  - `nsfw.ts` - NSFW image detection logic
  
- `/prisma` - Database schema and migrations
- `/test` - Test files and seed data
- `/dev` - Development Docker compose configuration

### Key Components

1. **Authentication Flow**:
   - Uses Microsoft Entra ID for OAuth
   - Stores Xbox Spartan tokens for Halo API access
   - Session management via Lucia Auth
   - Manual token injection required for development

2. **UGC (User Generated Content) System**:
   - Handles Halo Infinite maps, prefabs, and game variants
   - Soft delete support for content
   - Tag system for content categorization
   - Contributor tracking with Xbox gamertags

3. **Playlist Management**:
   - User-created collections of UGC via `UgcPair` model
   - UgcPair model allows pairing maps with gamemodes (both optional)
   - Privacy controls (public/private)
   - Favorite system for both UGC and playlists
   - New endpoints for managing pairs:
     - `GET /playlist/:playlistId/pairs` - Get all pairs in a playlist
     - `POST /playlist/:playlistId/pair` - Create a new pair (map and/or gamemode)
     - `DELETE /playlist/:playlistId/pair/:pairId` - Delete a specific pair

4. **Rate Limiting**:
   - Cloudflare IP detection support
   - Custom rate limiting via elysia-rate-limit

5. **Image Processing**:
   - Thumbnail generation and optimization
   - NSFW content detection
   - S3 storage integration

### API Structure
The API uses Elysia's plugin architecture with grouped routes:
- `/ugc` - User generated content endpoints
- `/playlists` - Playlist management endpoints  
- `/user` - User profile endpoints
- `/login`, `/logout` - Authentication endpoints
- `/favorites` - Favorite management endpoints

### Error Handling
Custom error classes in `/src/lib/errors.ts`:
- Unauthorized, Forbidden, NotFound, Duplicate, Unknown, Validation
- Centralized error handling in main app instance

### Environment Configuration
Required environment variables:
- Database connection (`DATABASE_URL`)
- Microsoft OAuth credentials (`AZURE_*`)
- S3 storage configuration (`AWS_*`, `S3_*`)
- Application settings (`PORT`, `CORS_URL`, `DOMAIN`)
- Development OAuth user (`OAUTH_USER`)

See `example.env` for full list of required variables.