import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  MONGODB_URI: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(1).required().messages({
      'any.required': 'MONGODB_URI is required when NODE_ENV is production',
    }),
    otherwise: Joi.string().default(
      'mongodb://localhost:27017/pethealth_vet_dev',
    ),
  }),
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required().messages({
      'any.required': 'JWT_SECRET is required when NODE_ENV is production',
      'string.min': 'JWT_SECRET must be at least 32 characters in production',
    }),
    otherwise: Joi.string().default('development-jwt-secret-change-me'),
  }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  OWNER_GRAPHQL_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri().required().messages({
      'any.required':
        'OWNER_GRAPHQL_URL is required when NODE_ENV is production',
    }),
    otherwise: Joi.string().uri().default('http://localhost:3000/graphql'),
  }),
  OWNER_SERVICE_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required().messages({
      'any.required':
        'OWNER_SERVICE_SECRET is required when NODE_ENV is production',
      'string.min':
        'OWNER_SERVICE_SECRET must be at least 32 characters in production',
    }),
    otherwise: Joi.string().default('dev-owner-service-secret-change-me'),
  }),
  /** Optional: team invitation emails via Resend. Without them, links are logged (dev) and shown to the inviting admin. */
  RESEND_API_KEY: Joi.string().allow('').optional(),
  RESEND_FROM_EMAIL: Joi.string().allow('').optional(),
  /** Optional: key for encrypting authenticator secrets (defaults to JWT_SECRET). Do not change once in use. */
  TWO_FACTOR_ENCRYPTION_KEY: Joi.string().allow('').optional(),
  /** Public clinic app URL used in invitation links. */
  VET_FRONTEND_URL: Joi.string().uri().default('http://localhost:5174'),
});
