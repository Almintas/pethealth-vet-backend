import { Query, Resolver } from '@nestjs/graphql';
import { HealthStatus } from './dto/health-status.object';

@Resolver()
export class HealthResolver {
  @Query(() => HealthStatus, { name: 'health' })
  health(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date(),
    };
  }
}
