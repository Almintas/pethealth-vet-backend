import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  MONGODB_URI: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(1).required().messages({
      'any.required':
        'MONGODB_URI is required when NODE_ENV is production',
    }),
    otherwise: Joi.string().default(
      'mongodb://localhost:27017/pethealth_vet_dev',
    ),
  }),
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required().messages({
      'any.required':
        'JWT_SECRET is required when NODE_ENV is production',
      'string.min':
        'JWT_SECRET must be at least 32 characters in production',
    }),
    otherwise: Joi.string().default('development-jwt-secret-change-me'),
  }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
});
