const { defineConfig } = require("drizzle-kit");

module.exports = defineConfig({
  dialect: "postgresql",
  schema: "./backend/db/schema.js",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});