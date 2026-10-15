import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import create_engine
from pathlib import Path

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5433/aegis_db")
engine = create_engine(DATABASE_URL)

def seed_database_from_csv(csv_path: str, sample_size: int = 50000):
    print(f"Loading dataset from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    print(f"Original dataset shape: {df.shape}")
    
    fraud_df = df[df['isFraud'] == 1]
    legit_df = df[df['isFraud'] == 0].sample(n=min(sample_size - len(fraud_df), len(df[df['isFraud'] == 0])), random_state=42)
    
    sampled_df = pd.concat([fraud_df, legit_df]).sample(frac=1, random_state=42).reset_index(drop=True)
    print(f"Sampled dataset shape for seeding: {sampled_df.shape}")
    
    base_time = datetime(2026, 1, 1, 0, 0, 0)
    
    transactions_data = []
    for idx, row in sampled_df.iterrows():
        tx_id = f"TX-{100000 + idx}"

        tx_timestamp = base_time + timedelta(hours=int(row['step']))
        
        transactions_data.append({
            "transaction_id": tx_id,
            "account_id": row['nameOrig'],
            "timestamp": tx_timestamp, 
            "amount": float(row['amount']),
            "type": str(row.get('type', 'TRANSFER')),
            "oldbalance_org": float(row.get('oldbalanceOrg', 0.0)),
            "newbalance_orig": float(row.get('newbalanceOrig', 0.0)),
            "oldbalance_dest": float(row.get('oldbalanceDest', 0.0)),
            "newbalance_dest": float(row.get('newbalanceDest', 0.0)),
            "device_id": f"DEV-SIM-{hash(row['nameOrig']) % 1000}",
            "session_id": f"SES-SIM-{idx}",
            "payment_attempts": 1,
            "is_fraud": int(row['isFraud']),
        })
    
    tx_df = pd.DataFrame(transactions_data)
    
    print("Inserting data into PostgreSQL database...")
    with engine.begin() as connection:
        tx_df.to_sql('transactions', con=connection, if_exists='append', index=False)
    
    print(f"Successfully seeded {len(tx_df)} rows into PostgreSQL database!")

if __name__ == "__main__":
    # Replace the path below with the location of your PaySim CSV file
    BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
    csv_file_path = BASE_DIR / "ml" / "data" / "ps.csv"
    seed_database_from_csv(csv_file_path, sample_size=50000)