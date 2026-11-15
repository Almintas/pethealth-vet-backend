import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { TwoFactorResolver } from './two-factor.resolver';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UsersModule,
  ],
  providers: [TwoFactorService, TwoFactorResolver],
})
export class TwoFactorModule {}
