import { Field, GraphQLISODateTime, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

@InputType()
export class AppointmentsScheduleQueryInput {
  @Field(() => GraphQLISODateTime, { nullable: true })
  @Type(() => Date)
  @IsOptional()
  @IsDate()
  scheduledFrom?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Type(() => Date)
  @IsOptional()
  @IsDate()
  scheduledTo?: Date;
}
