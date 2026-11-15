import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VeterinariansModule } from '../veterinarians/veterinarians.module';
import { User, UserSchema } from './schemas/user.schema';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    VeterinariansModule,
  ],
  providers: [UsersService, UsersResolver],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
