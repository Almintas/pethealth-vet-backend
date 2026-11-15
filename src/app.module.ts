import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'node:path';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ClinicPetAccessModule } from './clinic-pet-access/clinic-pet-access.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { MedicationsModule } from './medications/medications.module';
import { VaccinationsModule } from './vaccinations/vaccinations.module';
import { PatientsModule } from './patients/patients.module';
import { ClinicsModule } from './clinics/clinics.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { UsersModule } from './users/users.module';
import { VeterinariansModule } from './veterinarians/veterinarians.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('mongodb.uri');
        if (!uri) {
          throw new Error('MongoDB configuration is missing');
        }
        return { uri };
      },
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      context: ({ req }: { req: unknown }) => ({ req }),
    }),
    CommonModule,
    UsersModule,
    AuthModule,
    VeterinariansModule,
    ClinicsModule,
    ClinicPetAccessModule,
    PatientsModule,
    AppointmentsModule,
    MedicalRecordsModule,
    MedicationsModule,
    VaccinationsModule,
    HealthModule,
    InternalModule,
    AuditModule,
    AdminModule,
  ],
})
export class AppModule {}
