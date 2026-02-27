import { Kafka, CompressionTypes } from "kafkajs";
import { config } from "../config.js";

let producer = null;
let kafka = null;

export async function connectProducer(logger) {
    kafka = new Kafka({
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
    });
    producer = kafka.producer({idempotent: true});
    await producer.connect();
    logger.info('Kafka producer connected');
    return producer;
}

export async function publishBatch(events, logger) {
    const topics = {};
    const topicMessages = [];
    for (let event of events) {
        const topic = `${config.kafka.topicPrefix}.${event.type}`;
        if (!topics[topic]) {
            topics[topic] = [];
        }
        topics[topic].push(event);
    }
    for (let topic in topics) {
        topicMessages.push({ topic , messages: topics[topic].map((event) => ({
            key: event.event_id,
            value: JSON.stringify(event),
        }))})
    }
    try {
        await producer.sendBatch({
            topicMessages,
            compression: CompressionTypes.GZIP,
            acks: -1,
        });
    } catch (error) {
        publishToDlq(events, logger, error);
    }
}

async function publishToDlq(events, logger, error) {

    try {
        await producer.sendBatch({
            topicMessages: [
                {
                    topic: config.kafka.dlqTopic,
                    messages: events.map((event) => ({
                        key: event.event_id,
                        value: JSON.stringify({...event, failedAt: new Date().toISOString(), error: error.message}),
                    })),
                }
            ],
        });
    } catch (error) {
        logger.error(`Failed to send batch to Kafka: ${error.message}`);
    }
}

export async function checkKafkaHealth() {
    try {
        const admin = kafka.admin();
        await admin.connect();
        await admin.listTopics();
        await admin.disconnect();
        return true;
    } catch (error) {
        return false;
    }
}

export async function disconnectProducer() {
    if (producer) {
        await producer.disconnect();
        producer = null;
    }
}