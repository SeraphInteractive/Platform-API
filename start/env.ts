import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const),
  APP_KEY: Env.schema.string(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string(),
  DB_DATABASE: Env.schema.string(),

  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),

  DISCORD_CLIENT_ID: Env.schema.string.optional(),
  DISCORD_CLIENT_SECRET: Env.schema.string.optional(),
  DISCORD_REDIRECT_URI: Env.schema.string.optional(),
  DISCORD_BOT_TOKEN: Env.schema.string.optional(),
  DISCORD_GUILD_ID: Env.schema.string.optional(),
  DISCORD_CONTRIBUTOR_ROLE_ID: Env.schema.string.optional(),
  DISCORD_OBSERVER_ROLE_ID: Env.schema.string.optional(),

  CORS_ORIGIN: Env.schema.string(),

  ADMIN_DISCORD_IDS: Env.schema.string.optional(),
  SUPERVISOR_DISCORD_IDS: Env.schema.string.optional(),
  MODERATOR_DISCORD_IDS: Env.schema.string.optional(),
  SENIOR_DISCORD_IDS: Env.schema.string.optional(),

  // storage configuration for R2/S3
  S3_ENDPOINT: Env.schema.string.optional(),
  S3_REGION: Env.schema.string.optional(),
  S3_BUCKET: Env.schema.string.optional(),
  S3_ACCESS_KEY_ID: Env.schema.string.optional(),
  S3_SECRET_ACCESS_KEY: Env.schema.string.optional(),

  // discord webhook urls
  DISCORD_WEBHOOK_URL: Env.schema.string.optional(),
  DISCORD_SUPERVISOR_WEBHOOK_URL: Env.schema.string.optional(),
})
