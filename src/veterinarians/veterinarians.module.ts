import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  VeterinarianProfile,
  VeterinarianProfileSchema,
} from './schemas/veterinarian-profile.schema';
import { VeterinariansService } from './veterinarians.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VeterinarianProfile.name, schema: VeterinarianProfileSchema },
    ]),
  ],
  providers: [VeterinariansService],
  exports: [VeterinariansService, MongooseModule],
})
export class VeterinariansModule {}
