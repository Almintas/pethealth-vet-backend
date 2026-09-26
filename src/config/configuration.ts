export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  mongodb: {
    uri: process.env.MONGODB_URI,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  owner: {
    graphqlUrl: process.env.OWNER_GRAPHQL_URL,
    serviceSecret: process.env.OWNER_SERVICE_SECRET,
  },
});
