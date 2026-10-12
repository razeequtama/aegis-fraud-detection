-- AEGIS Database Schema (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Accounts Table
CREATE TABLE accounts (
    account_id VARCHAR(64) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(32) DEFAULT 'active',
    risk_tier VARCHAR(16) DEFAULT 'standard'
);

-- 2. Devices Table
CREATE TABLE devices (
    device_id VARCHAR(64) PRIMARY KEY,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    os_type VARCHAR(32)
);

-- 3. Transactions Table (Integrated with PaySim features)
CREATE TABLE transactions (
    transaction_id VARCHAR(64) PRIMARY KEY,
    step INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    name_orig VARCHAR(64) REFERENCES accounts(account_id),
    oldbalance_org NUMERIC(15, 2) NOT NULL,
    newbalance_orig NUMERIC(15, 2) NOT NULL,
    name_dest VARCHAR(64) NOT NULL,
    oldbalance_dest NUMERIC(15, 2) NOT NULL,
    newbalance_dest NUMERIC(15, 2) NOT NULL,
    device_id VARCHAR(64) REFERENCES devices(device_id),
    session_id VARCHAR(64),
    is_fraud BOOLEAN DEFAULT FALSE,
    is_flagged_fraud BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Model Versions Table
CREATE TABLE model_versions (
    model_version_id VARCHAR(64) PRIMARY KEY,
    algorithm_name VARCHAR(64) NOT NULL,
    hyperparameters JSONB,
    metrics JSONB,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Risk Assessments Table
CREATE TABLE risk_assessments (
    assessment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(64) REFERENCES transactions(transaction_id),
    model_version_id VARCHAR(64) REFERENCES model_versions(model_version_id),
    risk_score NUMERIC(5, 4) NOT NULL,
    decision VARCHAR(20) NOT NULL, -- 'approve', 'review', 'decline'
    signals JSONB,
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Investigation Cases Table
CREATE TABLE investigation_cases (
    case_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(64) REFERENCES transactions(transaction_id),
    assigned_analyst VARCHAR(64),
    status VARCHAR(32) DEFAULT 'open', -- 'open', 'in_progress', 'closed'
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Analyst Feedback Table
CREATE TABLE analyst_feedback (
    feedback_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES investigation_cases(case_id),
    transaction_id VARCHAR(64) REFERENCES transactions(transaction_id),
    analyst_label VARCHAR(32) NOT NULL, -- 'confirmed_fraud', 'legitimate', 'inconclusive'
    reasoning TEXT,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Replay Runs Table
CREATE TABLE replay_runs (
    replay_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_version_id VARCHAR(64) REFERENCES model_versions(model_version_id),
    threshold_config JSONB NOT NULL,
    summary_results JSONB,
    status VARCHAR(32) DEFAULT 'queued', -- 'queued', 'running', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Audit Logs Table
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor VARCHAR(64) NOT NULL,
    action VARCHAR(128) NOT NULL,
    target_entity VARCHAR(64),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);