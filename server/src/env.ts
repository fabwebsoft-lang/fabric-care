import "dotenv/config";

const DEFAULT_MONGO_URI =
  "mongodb+srv://fabwebsoft_db_user:fab-web-123@cluster0.2tsyfd7.mongodb.net/fabric_care?retryWrites=true&w=majority&appName=Cluster0";

export const env = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || DEFAULT_MONGO_URI,
  jwtSecret: process.env.JWT_SECRET || "fabric-care-secret-key-super-secure-local-jwt-token-key-12345",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
};
