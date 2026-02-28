import fp from 'fastify-plugin';
import { config } from '../config.js';


export default fp(async (fastify, _opts) => {
    await fastify.register(import('@fastify/jwt'), {
        secret: config.auth.jwt.secret,
        sign: { expiresIn: config.auth.jwt.expiresIn },
        verify: { algorithms: ['HS256'] }
    });

    fastify.addHook('onRequest', async (request, reply) => {
        if (request.routeOptions?.config?.skipAuth) return;
        const apiKey = request.headers['x-api-key'];
        const authHeader = request.headers['authorization'];
        if (apiKey) {
            if (!config.auth.apiKeys.has(apiKey)) {
                return reply.code(401).send({ error: 'Invalid API key' });
            }
            return;
        }
        if (authHeader?.startsWith('Bearer ')) {
            try {
                await request.jwtVerify();
                return; 
            } catch (err) {
                return reply.code(401).send({ error: 'Invalid or expired token' });
            }
        }
        return reply.code(401).send({ error: 'Authentication required' });
    })
})

