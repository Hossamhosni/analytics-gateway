
import { config } from '../config.js';

export function enrichEvent(event, { requestId, sourceIp}) {
    const enriched = {
        ...event,
        messageId: event.messageId ?? requestId,
        sourceIp,
        gatewayVersion: config.server.version,
        receivedAt: new Date().toISOString(),
        requestId,
    };
    return enriched;
}

export function getIdempotencyKey(event) {
    if (event.messageId) return event.messageId;
    if (event.userId && event.type && event.timestamp) {
        return`${event.userId}:${event.type}:${event.timestamp}`
    }
    return null;
}