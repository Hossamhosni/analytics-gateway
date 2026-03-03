# Analytics Gateway

A production-grade, high-throughput event ingestion gateway built with Node.js. Accepts analytics events over HTTP, deduplicates them, enriches them with server-side metadata, and streams them to Kafka.

![CI](https://github.com/Hossamhosni/analytics-gateway/actions/workflows/ci.yml/badge.svg)

## Architecture

```
Client
  │  POST /v1/events
  ▼
Fastify (auth, rate-limit, validation)
  │
  ▼
Deduplication (Redis SET NX)
  │
  ▼
Enrichment (messageId, receivedAt, sourceIp, ...)
  │
  ▼
EventBuffer (in-memory, 200ms flush)
  │
  ▼
Kafka Producer ──► events.page_view / events.click / ...
                          │
                      events.dlq  (failed batches)
```

## Features

- **JWT + API Key authentication**
- **Per-endpoint rate limiting** via Redis
- **Idempotent deduplication** using Redis atomic `SET NX PX`
- **In-memory event buffer** with configurable size, flush interval, and backpressure
- **Kafka batch publishing** with GZIP compression and `acks: -1`
- **Dead-letter queue** for failed Kafka batches
- **Prometheus metrics** at `GET /metrics`
- **Health checks** at `/health`, `/health/live`, `/health/ready`
- **Grafana + Prometheus** observability stack via Docker Compose
- **GitHub Actions CI** on Node 20 and 22

## Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop

### 1. Clone and install

```bash
git clone https://github.com/Hossamhosni/analytics-gateway.git
cd analytics-gateway
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set API_KEYS and JWT_SECRET at minimum
```

### 3. Start infrastructure

```bash
docker compose up -d
```

This starts: Kafka, Zookeeper, Redis, Prometheus, Grafana, and Kafka UI.

### 4. Start the gateway

```bash
npm run dev
```

Server starts on `http://localhost:3000`.

## API Reference

### Authentication

Include one of these headers on every request:

| Header | Example |
|---|---|
| `X-API-Key` | `X-API-Key: dev-key-1` |
| `Authorization` | `Authorization: Bearer <jwt>` |

### Get a JWT token

```http
POST /v1/auth/token
Content-Type: application/json

{ "apiKey": "dev-key-1" }
```

```json
{ "token": "eyJ...", "expiresIn": "2h" }
```

### Ingest a single event

```http
POST /v1/events
Content-Type: application/json
X-API-Key: dev-key-1

{
  "type": "page_view",
  "timestamp": "2026-03-04T00:00:00Z",
  "payload": { "url": "/home" },
  "userId": "user-123",
  "sessionId": "sess-abc"
}
```

**Response `202 Accepted`:**
```json
{ "accepted": true, "requestId": "uuid" }
```

### Ingest a batch of events

```http
POST /v1/events/batch
Content-Type: application/json
X-API-Key: dev-key-1

[{ "type": "click", "timestamp": "...", "payload": {} }, ...]
```

### Health checks

| Endpoint | Description |
|---|---|
| `GET /health` | Full status — checks Redis and Kafka |
| `GET /health/live` | Liveness probe (always 200 if process is running) |
| `GET /health/ready` | Readiness probe (503 if dependencies are down) |
| `GET /metrics` | Prometheus metrics |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | — | `development` / `production` / `test` |
| `PORT` | `3000` | HTTP port |
| `API_KEYS` | — | Comma-separated valid API keys |
| `JWT_SECRET` | — | Min 32 chars |
| `JWT_EXPIRES_IN` | `2h` | JWT token TTL |
| `KAFKA_BROKERS` | — | e.g. `localhost:9092` |
| `KAFKA_CLIENT_ID` | — | Client identifier |
| `KAFKA_TOPIC_PREFIX` | `events` | Topics: `events.page_view`, etc. |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `RATE_LIMIT_MAX` | `1000` | Requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window in milliseconds |
| `BUFFER_MAX_SIZE` | `500` | Max events before backpressure |
| `BUFFER_FLUSH_INTERVAL_MS` | `200` | Flush interval |
| `DEDUP_TTL_SECONDS` | `3600` | Dedup key TTL |

## Development

### Run tests
```bash
npm test
```

### Load test
```bash
# Start the server first, then:
node tests/load/loadtest.js
```

### Observability

| Service | URL | Credentials |
|---|---|---|
| Kafka UI | http://localhost:8080 | — |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3001 | admin / admin |
