import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { TiersService } from '../../tiers/tiers.service';
import { Tier } from '../models/tier.model';
import { PaginatedTiers } from '../models/pagination.model';

@Resolver(() => Tier)
export class TiersResolver {
  constructor(private tiersService: TiersService) {}

  @Query(() => Tier, { name: 'tier' })
  async getTier(
    @Args('creatorAddress') creatorAddress: string,
    @Args('onChainId', { type: () => Int }) onChainId: number,
  ) {
    return this.tiersService.findOne(creatorAddress, onChainId);
  }

  @Query(() => PaginatedTiers, { name: 'tiers' })
  async getTiers(
    @Args('creatorAddress', { nullable: true }) creatorAddress?: string,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page?: number,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit?: number,
  ) {
    if (creatorAddress) {
      return this.tiersService.findByCreatorAddressPaginated(creatorAddress, page, limit);
    }
    return this.tiersService.findAll(page, limit);
  }
}
