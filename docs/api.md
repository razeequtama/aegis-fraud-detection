# Aegis API Specification & Contract

Base URL: `/api/v1`

This document defines the complete end-to-end API specification and communication contract between the React frontend and the FastAPI backend for the Aegis platform.

---

## 1. System Health Endpoint

### Get System Health Status

- **URL**: `/health`
- **Method**: `GET`
- **Description**: Checks the operational status of the API, database connectivity, and model loading state.

**Response Body (`200 OK`):**

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "database": "connected",
  "model_loaded": true,
  "timestamp": "2026-10-12T10:00:00Z"
}
```

---

## 2. Transactions Endpoints

### List / Search Transactions

- **URL**: `/transactions`
- **Method**: `GET`
- **Description**: Retrieves a server-side filtered and paginated list of transactions for the Transaction Explorer page.

**Query Parameters:**

- `page` (integer, optional): Page number for pagination (default: 1).
- `limit` (integer, optional): Number of items per page (default: 20).
- `status` (string, optional): Filter by decision status (approve, review, declined).
- `min_amount` (numeric, optional): Minimum transaction amount filter.
- `max_amount` (numeric, optional): Maximum transaction amount filter.
- `search` (string, optional): Search keyword for transaction ID, account ID, or device ID.

**Response Body (`200 OK`):**

```json
{
  "page": 1,
  "limit": 20,
  "total": 1420,
  "data": [
    {
      "transaction_id": "TX-10021",
      "step": 1,
      "type": "TRANSFER",
      "amount": 850000.00,
      "name_orig": "C429214117",
      "name_dest": "C1591654462",
      "risk_score": 0.78,
      "decision": "review",
      "is_fraud": false,
      "created_at": "2026-10-12T08:30:00Z"
    }
  ]
}
```

### Get Transaction Detail

- **URL**: `/transactions/{id}`
- **Method**: `GET`
- **Description**: Fetches comprehensive details of a single transaction, including balance changes, device info, and risk assessment history.

**Response Body (`200 OK`):**

```json
{
  "transaction_id": "TX-10021",
  "step": 1,
  "type": "TRANSFER",
  "amount": 850000.00,
  "name_orig": "C429214117",
  "oldbalance_org": 1089.00,
  "newbalance_orig": 28.69,
  "name_dest": "C1591654462",
  "oldbalance_dest": 0.00,
  "newbalance_dest": 0.00,
  "device_id": "DEV-021",
  "session_id": "SES-991",
  "is_fraud": false,
  "latest_assessment": {
    "risk_score": 0.78,
    "decision": "review",
    "model_version": "aegis-rf-0.1.0"
  }
}
```

---

## 3. Risk Assessment Endpoint

### Evaluate Transaction Risk

- **URL**: `/risk-assessments`
- **Method**: `POST`
- **Description**: Runs a transaction simulation through the ML model, applies decision policy thresholds, and returns the risk assessment without persisting the submitted values or result.

**Request Body:**

```json
{
  "transaction_id": "TX-10021",
  "step": 1,
  "type": "TRANSFER",
  "amount": 850000.00,
  "name_orig": "C429214117",
  "oldbalance_org": 1089.00,
  "newbalance_orig": 28.69,
  "name_dest": "C1591654462",
  "oldbalance_dest": 0.00,
  "newbalance_dest": 0.00,
  "device_id": "DEV-021",
  "session_id": "SES-991"
}
```

**Response Body (`200 OK`):**

```json
{
  "transaction_id": "TX-10021",
  "risk_score": 0.78,
  "decision": "review",
  "model_version": "aegis-rf-0.1.0",
  "signals": [
    {
      "name": "unusual_transaction_velocity",
      "description": "Activity exceeds configured velocity limits"
    },
    {
      "name": "shared_device_connections",
      "description": "Device is associated with multiple account entities"
    }
  ],
  "latency_ms": 42
}
```

---

## 4. Graph & Network Analysis Endpoint

### Get Transaction Neighborhood Network

- **URL**: `/transactions/{id}/network`
- **Method**: `GET`
- **Description**: Retrieves graph nodes and edges connected to a transaction, sharing accounts, devices, or sessions for network investigation.

**Query Parameters:**

- `depth` (integer, optional): Network exploration depth (default: 2).

**Response Body (`200 OK`):**

```json
{
  "center_node": "TX-10021",
  "nodes": [
    {
      "id": "TX-10021",
      "type": "transaction",
      "label": "Transaction 850,000"
    },
    {
      "id": "C429214117",
      "type": "account",
      "label": "Account C429214117"
    },
    {
      "id": "DEV-021",
      "type": "device",
      "label": "Device DEV-021"
    }
  ],
  "edges": [
    {
      "source": "TX-10021",
      "target": "C429214117",
      "relation": "initiated_by"
    },
    {
      "source": "C429214117",
      "target": "DEV-021",
      "relation": "used_device"
    }
  ]
}
```

---

## 5. Investigation Cases & Feedback Endpoints

### Create Investigation Case

- **URL**: `/cases`
- **Method**: `POST`
- **Description**: Opens a new manual review case for a suspicious transaction.

**Request Body:**

```json
{
  "transaction_id": "TX-10021",
  "assigned_analyst": "analyst_john",
  "notes": "Flagged due to unusual velocity and high risk score."
}
```

**Response Body (`201 Created`):**

```json
{
  "case_id": "d3b07384-d113-4ec6-a7e8-b861217e1234",
  "transaction_id": "TX-10021",
  "status": "open",
  "assigned_analyst": "analyst_john",
  "created_at": "2026-10-12T09:00:00Z"
}
```

### Submit Analyst Feedback / Labeling

- **URL**: `/cases/{id}/feedback`
- **Method**: `POST`
- **Description**: Records investigator label feedback on a case for future model retraining loops.

**Request Body:**

```json
{
  "transaction_id": "TX-10021",
  "analyst_label": "confirmed_fraud",
  "reasoning": "Account takeover verified through secondary authentication check.",
  "created_by": "analyst_john"
}
```

**Response Body (`201 Created`):**

```json
{
  "feedback_id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "case_id": "d3b07384-d113-4ec6-a7e8-b861217e1234",
  "transaction_id": "TX-10021",
  "analyst_label": "confirmed_fraud",
  "created_at": "2026-10-12T09:15:00Z"
}
```

---

## 6. Model Lab & Replay Simulation Endpoints

### List Available Models

- **URL**: `/models`
- **Method**: `GET`
- **Description**: Returns all registered model versions, hyperparameters, and performance metrics.

**Response Body (`200 OK`):**

```json
[
  {
    "model_version_id": "aegis-rf-0.1.0",
    "algorithm_name": "RandomForestClassifier",
    "metrics": {
      "precision": 0.89,
      "recall": 0.82,
      "pr_auc": 0.85
    },
    "is_active": true,
    "created_at": "2026-10-01T00:00:00Z"
  }
]
```

### Trigger Replay Simulation

- **URL**: `/replays`
- **Method**: `POST`
- **Description**: Initiates a background job to run historical data replay using candidate model thresholds.

**Request Body:**

```json
{
  "model_version_id": "aegis-rf-0.1.0",
  "threshold_config": {
    "review_threshold": 0.60,
    "decline_threshold": 0.85
  }
}
```

**Response Body (`202 Accepted`):**

```json
{
  "replay_id": "98765432-abcd-ef01-2345-6789abcdef01",
  "status": "queued",
  "created_at": "2026-10-12T09:30:00Z"
}
```

### Get Replay Status and Results

- **URL**: `/replays/{id}`
- **Method**: `GET`
- **Description**: Checks the completion status and comparative metrics of a replay job.

**Response Body (`200 OK`):**

```json
{
  "replay_id": "98765432-abcd-ef01-2345-6789abcdef01",
  "status": "completed",
  "summary_results": {
    "total_processed": 100000,
    "review_queue_count": 4100,
    "fraud_detected": 790,
    "false_positives": 3310
  }
}
```

---

## 7. Command Center & Metrics Endpoint

### Get Dashboard Overview Metrics

- **URL**: `/metrics/overview`
- **Method**: `GET`
- **Description**: Aggregates high-level system metrics for the Command Center dashboard.

**Query Parameters:**

- `time_range` (string, optional): Time range for metrics aggregation, e.g., 24h, 7d, 30d.

**Response Body (`200 OK`):**

```json
{
  "total_transactions_processed": 45210,
  "pending_reviews": 128,
  "fraud_rate_percentage": 1.62,
  "average_latency_ms": 38.5,
  "risk_distribution": {
    "low": 41200,
    "medium": 3882,
    "high": 128
  }
}
```