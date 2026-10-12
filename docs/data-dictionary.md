# Aegis Data Dictionary — PaySim Integration

This document defines the schema and data dictionary for the transaction and risk data processed within Aegis, utilizing the PaySim mobile money simulator dataset.

## Core Transaction Fields (`transactions` table)

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `transaction_id` | VARCHAR(64) | Unique identifier for the transaction (Primary Key). |
| `step` | INTEGER | Maps a unit of time in the real world (1 step = 1 hour, total 744 steps / 30 days). |
| `type` | VARCHAR(20) | Transaction category: CASH-IN, CASH-OUT, DEBIT, PAYMENT, or TRANSFER. |
| `amount` | NUMERIC(15, 2) | Amount of the transaction in local currency. |
| `name_orig` | VARCHAR(64) | Customer ID who initiated the transaction (maps to `accounts`)[cite: 1]. |
| `oldbalance_org` | NUMERIC(15, 2) | Initial customer balance before the transaction[cite: 1]. |
| `newbalance_orig` | NUMERIC(15, 2) | Customer balance after the transaction[cite: 1]. |
| `name_dest` | VARCHAR(64) | Recipient ID of the transaction (Customer or Merchant starting with 'M')[cite: 1]. |
| `oldbalance_dest` | NUMERIC(15, 2) | Initial recipient balance before the transaction[cite: 1]. |
| `newbalance_dest` | NUMERIC(15, 2) | Recipient balance after the transaction[cite: 1]. |
| `is_fraud` | BOOLEAN | Ground truth label identifying a fraudulent transaction (1) vs non-fraudulent (0)[cite: 1]. |
| `is_flagged_fraud` | BOOLEAN | Business model flag for massive transfers attempting > 200,000 in a single transaction[cite: 1]. |