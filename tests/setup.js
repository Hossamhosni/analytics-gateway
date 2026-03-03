// Sets required env vars before any module (including config.js) is imported.
// This prevents config.js from calling process.exit(1) in the test environment.

process.env.NODE_ENV = 'test';
process.env.API_KEYS = 'test-key-1,test-key-2';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long!!';
process.env.KAFKA_BROKERS = 'localhost:9092';
process.env.KAFKA_CLIENT_ID = 'test-gateway';
