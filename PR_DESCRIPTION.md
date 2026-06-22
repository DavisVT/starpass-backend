# Add GraphQL API support

## Summary

Adds GraphQL support using `@nestjs/graphql` with Apollo driver (code-first approach), exposing 6 core queries while keeping existing REST endpoints fully functional.

## Changes

### New Dependencies
- `@nestjs/graphql@^12` - NestJS GraphQL module
- `@nestjs/apollo@^12` - Apollo driver for NestJS GraphQL
- `graphql@^16` - GraphQL engine
- `@apollo/server@^4` - Apollo Server

### GraphQL Module (`src/graphql/`)
- **`graphql.module.ts`** - Configures code-first GraphQL with ApolloDriver, auto-generates schema file, enables playground in non-production at `/graphql`
- **`models/creator.model.ts`** - ObjectType for Creator (id, stellarAddress, email, displayName, bio, avatarUrl, totalEarned, registeredAt, createdAt, updatedAt)
- **`models/tier.model.ts`** - ObjectType for Tier (id, onChainId, name, description, priceUsdc, durationDays, maxSupply, minted, active, creator relation, createdAt, updatedAt)
- **`models/pass.model.ts`** - ObjectType for Pass (id, onChainId, tier, creator, fan relations, purchasedAt, expiresAt, txHash, active, createdAt)
- **`models/fan.model.ts`** - ObjectType for Fan (id, stellarAddress, displayName, createdAt, updatedAt)
- **`models/pagination.model.ts`** - PaginatedCreators, PaginatedTiers, PaginatedPasses wrapper types
- **`resolvers/creators.resolver.ts`** - Queries: `creator(address: String!)`, `creators(page: Int, limit: Int)`
- **`resolvers/tiers.resolver.ts`** - Queries: `tier(creatorAddress: String!, onChainId: Int!)`, `tiers(creatorAddress: String, page: Int, limit: Int)`
- **`resolvers/passes.resolver.ts`** - Query: `pass(id: ID!)`
- **`resolvers/fans.resolver.ts`** - Query: `fan(address: String!)`
- **`resolvers/*.spec.ts`** - Unit tests for all 4 resolvers (12 tests total)

### Service Changes
- **`passes/passes.service.ts`** - Added `findById(id)` method for GraphQL pass query; injected `AdminConfigService` (fixing pre-existing missing dependency)
- **`tiers/tiers.service.ts`** - Added `findByCreatorAddressPaginated()` for GraphQL tiers query; removed duplicate `findAll` implementations; added missing `CreateTierDto` and `ForbiddenException` imports

### Module Changes
- **`app.module.ts`** - Added `GraphqlAppModule` import; fixed pre-existing middleware import reference
- **`main.ts`** - Added GraphQL playground URL log
- **`passes/passes.module.ts`** - Added `AdminModule` import for `AdminConfigService`

## Queries

```graphql
# Get a single creator by Stellar address
creator(address: "G...") {
  id, stellarAddress, displayName, bio, avatarUrl, totalEarned
}

# List creators with pagination
creators(page: 1, limit: 20) {
  data { id, stellarAddress, displayName }
  total, page, limit
}

# Get a specific tier by creator address and on-chain ID
tier(creatorAddress: "G...", onChainId: 1) {
  id, name, description, priceUsdc, durationDays, active
}

# List tiers with optional creator filter
tiers(creatorAddress: "G...", page: 1, limit: 20) {
  data { id, name, priceUsdc }
  total, page, limit
}

# Get a pass by ID
pass(id: "uuid") {
  id, onChainId, active, purchasedAt, expiresAt
  tier { name }
  creator { displayName }
  fan { stellarAddress }
}

# Get a fan by Stellar address
fan(address: "G...") {
  id, stellarAddress, displayName
}
```

## Testing
- All 12 new GraphQL resolver tests pass
- All pre-existing passing tests remain unaffected
- Playground available at `/graphql` in non-production environments
- REST endpoints unchanged and fully functional

closes #70
