import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { VeterinariansModule } from '../veterinarians/veterinarians.module';
import { ClinicTeamResolver } from './clinic-team.resolver';
import { ClinicTeamService } from './clinic-team.service';
import {
  ClinicInvitation,
  ClinicInvitationSchema,
} from './schemas/clinic-invitation.schema';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ClinicsModule,
    UsersModule,
    VeterinariansModule,
    MailModule,
    MongooseModule.forFeature([
      { name: ClinicInvitation.name, schema: ClinicInvitationSchema },
    ]),
  ],
  providers: [ClinicTeamService, ClinicTeamResolver],
})
export class ClinicTeamModule {}
