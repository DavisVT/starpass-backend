import { Resolver, Query, Args } from '@nestjs/graphql';
import { PassesService } from '../../passes/passes.service';
import { Pass } from '../models/pass.model';

@Resolver(() => Pass)
export class PassesResolver {
  constructor(private passesService: PassesService) {}

  @Query(() => Pass, { name: 'pass' })
  async getPass(@Args('id') id: string) {
    return this.passesService.findById(id);
  }
}
