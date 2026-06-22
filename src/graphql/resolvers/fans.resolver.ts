import { Resolver, Query, Args } from '@nestjs/graphql';
import { FansService } from '../../fans/fans.service';
import { Fan } from '../models/fan.model';

@Resolver(() => Fan)
export class FansResolver {
  constructor(private fansService: FansService) {}

  @Query(() => Fan, { name: 'fan' })
  async getFan(@Args('address') address: string) {
    return this.fansService.findByAddress(address);
  }
}
