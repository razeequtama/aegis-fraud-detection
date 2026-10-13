import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import os

def load_and_preprocess_data(filepath: str):
    """
    Load PaySim dataset, handle missing values, and engineer powerful fraud features.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Dataset not found at {filepath}. Please provide a valid dataset.")
        
    print("Loading CSV file (this might take a moment for 6M rows)...")
    df = pd.read_csv(filepath)
    
    # PaySim uses 'step' as time units. Sort chronologically.
    if 'step' in df.columns:
        df = df.sort_values('step').reset_index(drop=True)
        
    # Standardize label column name
    if 'isFraud' in df.columns and 'label' not in df.columns:
        df['label'] = df['isFraud']
        
    # Feature Engineering for PaySim: Balance error indicators 
    # Fraudsters often leave discrepancies in account balances during transfers/cash-outs
    if all(col in df.columns for col in ['oldbalanceOrg', 'newbalanceOrig', 'amount']):
        df['errorBalanceOrg'] = df['newbalanceOrig'] + df['amount'] - df['oldbalanceOrg']
    if all(col in df.columns for col in ['oldbalanceDest', 'newbalanceDest', 'amount']):
        df['errorBalanceDest'] = df['oldbalanceDest'] + df['amount'] - df['newbalanceDest']
        
    # One-Hot Encoding for transaction type if present
    if 'type' in df.columns:
        df = pd.get_dummies(df, columns=['type'], drop_first=True)
        
    return df

def time_based_train_test_split(df: pd.DataFrame, test_size: float = 0.2, train_sample_ratio: float = 0.25):
    """
    Perform a strict time-based split, then subsample the training set to 
    prevent memory overflow on local laptops while keeping evaluation rigorous.
    """
    split_index = int(len(df) * (1 - test_size))
    
    train_df = df.iloc[:split_index].copy()
    test_df = df.iloc[split_index:].copy()
    
    # Subsample training data for fast local iteration (e.g. 25% of 5M = ~1.2M rows)
    if train_sample_ratio < 1.0:
        print(f"Subsampling training set to {int(train_sample_ratio * 100)}% for optimal training speed...")
        train_df = train_df.sample(frac=train_sample_ratio, random_state=42).reset_index(drop=True)
        if 'step' in train_df.columns:
            train_df = train_df.sort_values('step').reset_index(drop=True)
            
    return train_df, test_df

def prepare_features_and_labels(train_df: pd.DataFrame, test_df: pd.DataFrame, feature_columns: list, label_column: str = 'label'):
    """
    Extract features and labels, then scale numerical features using training statistics only.
    """
    # Filter only available columns to prevent key errors
    valid_features = [col for col in feature_columns if col in train_df.columns and col in test_df.columns]
    
    X_train = train_df[valid_features].fillna(0)
    y_train = train_df[label_column]
    
    X_test = test_df[valid_features].fillna(0)
    y_test = test_df[label_column]
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    return X_train_scaled, X_test_scaled, y_train, y_test, scaler, valid_features