import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { VeterinariansModule } from '../veterinarians/veterinarians.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { GqlRolesGuard } from './guards/gql-roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    VeterinariansModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        if (!secret) {
          throw new Error('JWT configuration is missing');
        }
        const expiresIn = configService.get<string>('jwt.expiresIn') ?? '7d';
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as `${number}d`,
          },
        };
      },
    }),
  ],
  providers: [
    AuthService,
    AuthResolver,
    JwtStrategy,
    GqlAuthGuard,
    GqlRolesGuard,
  ],
  exports: [AuthService, GqlAuthGuard, JwtModule, GqlRolesGuard],
})
export class AuthModule {}
