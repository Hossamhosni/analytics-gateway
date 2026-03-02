import fp from 'fastify-plugin';
import { v4 as uuidv4 } from 'uuid';

export default fp(async (fastify, _opts) => {
    fastify.addHook('onRequest', (request, reply, done) => {
        request.id = request.headers['x-request-id'] || uuidv4();
        done();
    });

    fastify.addHook('onSend', async (request, reply, payload) => {
        reply.header('x-request-id', request.id);
        return payload;
    })
});