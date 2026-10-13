import os
import joblib
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import precision_score, recall_score, average_precision_score, confusion_matrix
from preprocessing import load_and_preprocess_data, time_based_train_test_split, prepare_features_and_labels

def evaluate_model(model, X_test, y_test, threshold=0.5):
    """
    Evaluate model performance using classification metrics suited for imbalanced data.
    """
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= threshold).astype(int)
    
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    pr_auc = average_precision_score(y_test, y_prob)
    conf_matrix = confusion_matrix(y_test, y_pred)
    
    metrics = {
        "precision": precision,
        "recall": recall,
        "pr_auc": pr_auc,
        "confusion_matrix": conf_matrix.tolist()
    }
    return metrics, y_prob

def train_baseline_models():
    data_path = "ml/data/ps.csv"
    artifacts_dir = "ml/artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)
    
    print("Loading and preprocessing PaySim dataset...")
    df = load_and_preprocess_data(data_path)
    
    # Comprehensive feature list including core amounts, balances, error metrics, and dummy transaction types
    base_features = [
        'amount', 'oldbalanceOrg', 'newbalanceOrig', 
        'oldbalanceDest', 'newbalanceDest', 
        'errorBalanceOrg', 'errorBalanceDest'
    ]
    # Add dynamic one-hot encoded transaction types if they exist in df
    type_features = [col for col in df.columns if col.startswith('type_')]
    feature_columns = base_features + type_features
    
    label_column = 'label'
    
    # Split data chronologically and subsample training data safely
    train_df, test_df = time_based_train_test_split(df, test_size=0.2, train_sample_ratio=0.25)
    
    X_train, X_test, y_train, y_test, scaler, used_features = prepare_features_and_labels(
        train_df, test_df, feature_columns, label_column
    )
    print(f"Final features used for training: {used_features}")
    
    # 1. Train Logistic Regression Baseline
    print("\nTraining Logistic Regression baseline...")
    lr_model = LogisticRegression(class_weight='balanced', max_iter=500, random_state=42)
    lr_model.fit(X_train, y_train)
    
    lr_metrics, _ = evaluate_model(lr_model, X_test, y_test)
    print("Logistic Regression Metrics:", lr_metrics)
    
    # 2. Train Random Forest Baseline (optimized for balance and speed)
    print("\nTraining Random Forest baseline...")
    rf_model = RandomForestClassifier(
        n_estimators=50, 
        max_depth=15, 
        class_weight='balanced_subsample', 
        random_state=42, 
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)
    
    rf_metrics, _ = evaluate_model(rf_model, X_test, y_test)
    print("Random Forest Metrics:", rf_metrics)
    
    # Save best model artifacts
    joblib.dump(rf_model, os.path.join(artifacts_dir, "fraud_rf_model.joblib"))
    joblib.dump(scaler, os.path.join(artifacts_dir, "scaler.joblib"))
    print(f"\nModel artifacts successfully saved to {artifacts_dir}/")

if __name__ == "__main__":
    train_baseline_models()