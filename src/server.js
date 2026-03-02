import pino from 'pino';
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { connectRedis, disconnectRedis } from "./redis/client.js";
import { connectProducer, disconnectProducer } from "./kafka/producer.js";

const logger = pino({
    level: config.server.logLevel,
    transport: config.isDevelopment ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});

export async function start() {
    try {
        await connectRedis(logger);
        const app = await buildApp();
        await connectProducer(app.log);
        await app.listen({
            port: config.server.port,
            host: config.server.host,
        });
        app.log.info(`Server running on port ${config.server.port}`);

        const shutdown = async (signal) => {
            app.log.info({ signal }, 'Shutting down server');
            await app.eventBuffer.drain();
            await app.close();
            await disconnectProducer(app.log);
            await disconnectRedis(app.log);
            app.log.info('Server stopped');
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT',  () => shutdown('SIGINT'));
    } catch (error) {
        console.error('Failed to start server', error);
        process.exit(1);
    }
}

start();
