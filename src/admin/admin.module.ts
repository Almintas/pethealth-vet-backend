import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { VeterinariansModule } from '../veterinarians/veterinarians.module';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { AdminAction, AdminActionSchema } from './schemas/admin-action.schema';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UsersModule,
    VeterinariansModule,
    MongooseModule.forFeature([
      { name: AdminAction.name, schema: AdminActionSchema },
    ]),
  ],
  providers: [AdminService, AdminResolver],
})
export class AdminModule {}
