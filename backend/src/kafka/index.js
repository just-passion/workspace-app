const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'workspace-app',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || 'workspace-consumers' });

// ── Topics ────────────────────────────────────────────
const TOPICS = {
  TASK_EVENTS: 'task-events',
  CHAT_EVENTS: 'chat-events',
  NOTIFICATION_EVENTS: 'notification-events',
  ACTIVITY_EVENTS: 'activity-events',
};

async function connectKafka() {
  try {
    await producer.connect();
    await consumer.connect();

    // Subscribe to all topics
    await consumer.subscribe({ topics: Object.values(TOPICS), fromBeginning: false });

    // Start consuming
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value.toString());
          await handleEvent(topic, event);
        } catch (err) {
          logger.error(`Kafka message error [${topic}]:`, err);
        }
      },
    });

    logger.info('✅ Kafka connected (producer + consumer)');
  } catch (err) {
    logger.warn('⚠️  Kafka not available, running without it:', err.message);
  }
}

// ── Publish ───────────────────────────────────────────
async function publishEvent(topic, eventType, payload) {
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify({ eventType, payload, timestamp: new Date() }) }],
    });
  } catch (err) {
    logger.warn('Kafka publish failed (non-critical):', err.message);
  }
}

// ── Event Handlers ────────────────────────────────────
async function handleEvent(topic, event) {
  const { eventType, payload } = event;
  logger.debug(`Kafka event: [${topic}] ${eventType}`);

  switch (topic) {
    case TOPICS.TASK_EVENTS:
      await handleTaskEvent(eventType, payload);
      break;
    case TOPICS.NOTIFICATION_EVENTS:
      await handleNotificationEvent(eventType, payload);
      break;
    case TOPICS.ACTIVITY_EVENTS:
      await handleActivityEvent(eventType, payload);
      break;
  }
}

async function handleTaskEvent(eventType, payload) {
  const { ActivityLog } = require('../models/postgres/index');
  if (['task_created', 'task_updated', 'task_status_changed'].includes(eventType)) {
    await ActivityLog.create({
      workspaceId: payload.workspaceId,
      userId: payload.userId,
      eventType,
      metadata: payload,
    });
  }
}

async function handleNotificationEvent(eventType, payload) {
  const { Notification } = require('../models/postgres/index');
  await Notification.create({
    userId: payload.targetUserId,
    type: eventType,
    message: payload.message,
    metadata: payload,
  });
}

async function handleActivityEvent(eventType, payload) {
  const { ActivityLog } = require('../models/postgres/index');
  await ActivityLog.create({
    workspaceId: payload.workspaceId,
    userId: payload.userId,
    eventType,
    metadata: payload,
  });
}

module.exports = { connectKafka, publishEvent, TOPICS };
