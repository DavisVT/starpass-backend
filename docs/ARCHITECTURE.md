# Architecture

## Overview

StarPass Backend is a NestJS API that serves as the off-chain layer for the StarPass platform. It indexes Soroban contract events into PostgreSQL for fast queries, provides REST endpoints for the frontend, and handles Stellar keypair authentication.

## System Architecture

```
Frontend (Next.js)
        │
        │ HTTP REST
        ▼
StarPass Backend (NestJS)
        │
        ├── PostgreSQL (Prisma ORM)
        │   └── Users, Creators, Fans, Tiers, Passes, Sessions
        │
        ├── Soroban RPC
        │   └── Event indexer polls every 10s
        │   └── Direct contract calls for access checks
        │
        └── Stellar SDK
            └── Signature verification for auth
```

## Module Structure

```
src/
├── auth/           # Stellar keypair auth + JWT issuance
├── creators/       # Creator profiles and registration
├── fans/           # Fan profiles and subscriptions
├── tiers/          # Membership tier management
├── passes/         # Pass access checking — core gating logic
├── indexer/        # Soroban event indexer (background service)
├── stellar/        # Stellar RPC service
└── common/         # Prisma, guards, shared utilities
```

## Authentication Flow

StarPass uses Stellar keypair signatures instead of passwords:

```
1. Client calls GET /auth/challenge?address=GFAN...
   → Server returns a timestamped challenge message

2. Client signs the challenge with their Stellar private key
   → Produces a base64 signature

3. Client calls POST /auth/login with { stellarAddress, message, signature }
   → Server verifies signature using Stellar SDK
   → Server issues a JWT on success

4. Client includes JWT in Authorization: Bearer <token> header
   → JwtAuthGuard validates on protected routes
```

## Indexer Architecture

The indexer is a background NestJS service that polls the Soroban RPC for new contract events:

```
IndexerService.onModuleInit()
    └── setInterval(processNewEvents, 10000ms)
            └── getCheckpoint() → last processed ledger
            └── stellar.getContractEvents(fromLedger)
            └── for each event:
                    ├── creator_registered → upsert User + Creator
                    ├── tier_created → upsert Tier
                    ├── tier_deactivated → mark Tier inactive
                    └── pass_minted → upsert Pass
            └── updateCheckpoint(latestLedger)
```

The checkpoint is stored in `IndexerCheckpoint` table with a singleton row. This ensures the indexer resumes from the correct ledger after a restart.

## Access Gating

The core value of the backend is the access-check endpoints:

```
GET /passes/check/:fanAddress/tier/:tierId
GET /passes/check/:fanAddress/creator/:creatorAddress
```

These query PostgreSQL (fast, no chain call needed) because the indexer keeps the DB in sync. For time-critical checks, the `StellarService.hasValidPassOnChain()` method queries the contract directly.

## Database Schema

See `prisma/schema.prisma` for the full schema. Key relationships:

```
User (1) ──── (1) Creator ──── (many) Tier ──── (many) Pass
User (1) ──── (1) Fan ─────────────────────────── (many) Pass
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for JWT signing |
| `STELLAR_RPC_URL` | ✅ | Soroban RPC endpoint |
| `STARPASS_CONTRACT_ID` | ✅ | Deployed StarPass contract address |
| `INDEXER_ENABLED` | ❌ | Set to `false` to disable indexer (default: true) |
| `INDEXER_INTERVAL_MS` | ❌ | Poll interval in ms (default: 10000) |
| `PORT` | ❌ | API port (default: 4000) |
| `FRONTEND_URL` | ❌ | CORS allowed origin (default: http://localhost:3000) |
