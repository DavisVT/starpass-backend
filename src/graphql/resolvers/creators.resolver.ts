import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { CreatorsService } from '../../creators/creators.service';
import { Creator } from '../models/creator.model';
import { PaginatedCreators } from '../models/pagination.model';

@Resolver(() => Creator)
export class CreatorsResolver {
  constructor(private creatorsService: CreatorsService) {}

  @Query(() => Creator, { name: 'creator' })
  async getCreator(@Args('address') address: string) {
    return this.creatorsService.findByAddress(address);
  }

  @Query(() => PaginatedCreators, { name: 'creators' })
  async getCreators(
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit: number,
  ) {
    return this.creatorsService.findAll(page, limit);
  }
}
