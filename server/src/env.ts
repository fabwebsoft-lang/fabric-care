import "dotenv/config";

export const env = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fabric_care",
  jwtSecret: process.env.JWT_SECRET || "fabric-care-secret-key-super-secure-local-jwt-token-key-12345",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
};
