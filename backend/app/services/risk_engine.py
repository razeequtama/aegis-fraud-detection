import os
from pathlib import Path
import joblib
import numpy as np
import pandas as pd

from app.services.graph_analysis import graph_analyzer
from app.core.redis import check_transaction_velocity


class RiskEngine:
    MODEL_VERSION = "aegis-rf-0.1.0"
    REVIEW_THRESHOLD = 0.40
    DECLINE_THRESHOLD = 0.75

    def __init__(self):
        artifacts_dir = Path(
            os.getenv(
                "ML_ARTIFACTS_DIR",
                Path(__file__).resolve().parents[3] / "ml" / "artifacts",
            )
        )
        self.model_path = artifacts_dir / "fraud_rf_model.joblib"
        self.scaler_path = artifacts_dir / "scaler.joblib"

        self.model = None
        self.scaler = None
        self.model_version = self.MODEL_VERSION
        self.load_artifacts()

    def load_artifacts(self):
        """Load trained Random Forest model and scaler safely."""
        try:
            if self.model_path.is_file() and self.scaler_path.is_file():
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.model_version = getattr(self.model, "model_version", self.MODEL_VERSION)
                print("RiskEngine: Model and scaler loaded successfully.")
            else:
                print("RiskEngine Warning: Model artifacts not found. Engine will run in fallback mode.")
        except Exception as exc:
            print(f"RiskEngine Error loading artifacts: {exc}")

    def _normalize_transaction_type(self, tx_type):
        return str(tx_type or "TRANSFER").upper()

    def _get_type_flags(self, tx_type):
        normalized = self._normalize_transaction_type(tx_type)
        return {
            "CASH_OUT": 1 if normalized == "CASH_OUT" else 0,
            "CASH_IN": 1 if normalized == "CASH_IN" else 0,
            "DEBIT": 1 if normalized == "DEBIT" else 0,
            "PAYMENT": 1 if normalized == "PAYMENT" else 0,
            "TRANSFER": 1 if normalized == "TRANSFER" else 0,
        }

    def _build_feature_vector(self, tx_data: dict) -> np.ndarray:
        amount = float(tx_data.get("amount", 0.0) or 0.0)
        oldbalance_org = float(tx_data.get("oldbalanceOrg", tx_data.get("oldbalance_org", 0.0)) or 0.0)
        newbalance_orig = float(tx_data.get("newbalanceOrig", tx_data.get("newbalance_orig", 0.0)) or 0.0)
        oldbalance_dest = float(tx_data.get("oldbalanceDest", tx_data.get("oldbalance_dest", 0.0)) or 0.0)
        newbalance_dest = float(tx_data.get("newbalanceDest", tx_data.get("newbalance_dest", 0.0)) or 0.0)

        error_balance_org = newbalance_orig + amount - oldbalance_org
        error_balance_dest = oldbalance_dest + amount - newbalance_dest

        type_flags = self._get_type_flags(tx_data.get("type", "TRANSFER"))

        feature_vector = [
            amount,
            oldbalance_org,
            newbalance_orig,
            oldbalance_dest,
            newbalance_dest,
            error_balance_org,
            error_balance_dest,
            type_flags["CASH_OUT"],
            type_flags["DEBIT"],
            type_flags["PAYMENT"],
            type_flags["TRANSFER"],
        ]
        return np.array([feature_vector], dtype=float)

    def predict_proba_batch(self, feature_matrix: np.ndarray) -> np.ndarray:
        """Run vectorized continuous inference on a 2D matrix of features, returning calibrated fraud scores."""
        n_samples = len(feature_matrix)
        if n_samples == 0:
            return np.array([], dtype=float)

        raw_probs = np.full(n_samples, 0.5, dtype=float)
        if self.model is not None and self.scaler is not None:
            try:
                if hasattr(self.scaler, "feature_names_in_"):
                    df = pd.DataFrame(feature_matrix, columns=self.scaler.feature_names_in_)
                    scaled = self.scaler.transform(df)
                else:
                    scaled = self.scaler.transform(feature_matrix)
                raw_probs = self.model.predict_proba(scaled)[:, 1]
            except Exception as exc:
                print(f"Batch inference error: {exc}")

        # Vectorized pattern scoring
        amounts = feature_matrix[:, 0]
        oldbalance_org = feature_matrix[:, 1]
        newbalance_orig = feature_matrix[:, 2]
        oldbalance_dest = feature_matrix[:, 3]
        newbalance_dest = feature_matrix[:, 4]
        err_org = np.abs(feature_matrix[:, 5])
        err_dest = np.abs(feature_matrix[:, 6])
        is_cash_out = feature_matrix[:, 7]
        is_transfer = feature_matrix[:, 10]

        drain = np.where(oldbalance_org > 0, amounts / np.maximum(oldbalance_org, 1.0), 0.0)

        pattern_penalties = np.zeros(n_samples, dtype=float)
        # Drain ratio
        pattern_penalties += np.where((drain >= 0.95) & (amounts >= 5000), 0.35,
                             np.where((drain >= 0.70) & (amounts >= 5000), 0.20,
                             np.where((drain >= 0.40) & (amounts >= 10000), 0.10, 0.0)))
        # Discrepancies
        pattern_penalties += np.where(err_org > 1.0, np.minimum(0.25, 0.12 + (err_org / np.maximum(amounts, 1.0)) * 0.12), 0.0)
        pattern_penalties += np.where((err_dest > 1.0) & (oldbalance_dest > 0), 0.10, 0.0)
        # Amounts
        pattern_penalties += np.where(amounts >= 1000000, 0.25,
                             np.where(amounts >= 200000, 0.15,
                             np.where(amounts >= 50000, 0.08,
                             np.where(amounts <= 10000, -0.05, 0.0))))
        # Types
        pattern_penalties += np.where(is_cash_out == 1, 0.08, np.where(is_transfer == 1, 0.04, -0.05))

        base_score = 0.05
        composites = np.where(
            raw_probs >= 0.70,
            np.maximum(raw_probs, 0.75 + 0.24 * np.clip(pattern_penalties, 0.0, 1.0)),
            base_score + 0.45 * raw_probs + 0.75 * pattern_penalties
        )
        return np.round(np.clip(composites, 0.01, 0.99), 4)

    def _apply_decision_policy(
        self, risk_score: float, signals: list[dict], lang: str = "en"
    ) -> tuple[str, list[dict]]:
        is_id = lang == "id"
        if risk_score >= self.DECLINE_THRESHOLD:
            decision = "decline"
            signals.insert(0, {
                "name": "high_fraud_probability",
                "description": (
                    "Model risiko komposit memprediksi probabilitas kritis dari aktivitas transaksi penipuan."
                    if is_id
                    else "Composite risk model predicts a critical probability of fraudulent transaction activity."
                ),
            })
        elif risk_score >= self.REVIEW_THRESHOLD:
            decision = "review"
            signals.insert(0, {
                "name": "moderate_risk_pattern",
                "description": (
                    "Transaksi menunjukkan peningkatan sinyal anomali melebihi ambang batas peninjauan; ditandai untuk pemeriksaan analis."
                    if is_id
                    else "Transaction exhibits elevated anomaly signals exceeding review threshold; flagged for analyst inspection."
                ),
            })
        else:
            decision = "approve"

        return decision, signals

    def evaluate_transaction(
        self,
        tx_data: dict,
        historical_transactions: list | None = None,
        check_velocity: bool = True,
    ) -> dict:
        """Process an incoming transaction using multi-factor pattern scoring and decision policy."""
        if historical_transactions is None:
            historical_transactions = []

        account_id = tx_data.get("account_id")
        graph_features = {}
        if account_id:
            if historical_transactions:
                graph_analyzer.build_graph_from_transactions(historical_transactions)
            graph_features = graph_analyzer.extract_graph_features(account_id)

        amount = float(tx_data.get("amount", 0.0) or 0.0)
        oldbalance_org = float(tx_data.get("oldbalanceOrg", tx_data.get("oldbalance_org", 0.0)) or 0.0)
        newbalance_orig = float(tx_data.get("newbalanceOrig", tx_data.get("newbalance_orig", 0.0)) or 0.0)
        oldbalance_dest = float(tx_data.get("oldbalanceDest", tx_data.get("oldbalance_dest", 0.0)) or 0.0)
        newbalance_dest = float(tx_data.get("newbalanceDest", tx_data.get("newbalance_dest", 0.0)) or 0.0)
        payment_attempts = int(tx_data.get("payment_attempts", 1) or 1)
        tx_type_raw = tx_data.get("type", "TRANSFER")
        tx_type_normalized = self._normalize_transaction_type(tx_type_raw)

        error_balance_org = newbalance_orig + amount - oldbalance_org
        error_balance_dest = oldbalance_dest + amount - newbalance_dest

        features = self._build_feature_vector(tx_data)
        raw_model_prob = 0.0

        if self.model and self.scaler:
            try:
                if hasattr(self.scaler, "feature_names_in_"):
                    df_features = pd.DataFrame(features, columns=self.scaler.feature_names_in_)
                    scaled_features = self.scaler.transform(df_features)
                else:
                    scaled_features = self.scaler.transform(features)
                raw_model_prob = float(self.model.predict_proba(scaled_features)[0][1])
            except Exception as exc:
                print(f"Inference error: {exc}")
                raw_model_prob = 0.5
        else:
            raw_model_prob = 0.85 if amount > 200000 and abs(error_balance_org) > 1.0 else 0.12

        # Pattern scoring & behavioral factors
        signals: list[dict] = []
        pattern_penalty = 0.0
        lang = str(tx_data.get("language") or tx_data.get("lang") or "en").lower()
        is_id = lang == "id"

        # 1. Drain ratio
        drain_ratio = (amount / oldbalance_org) if oldbalance_org > 0 else 0.0
        if drain_ratio >= 0.95 and amount >= 5000:
            pattern_penalty += 0.35
            signals.append({
                "name": "critical_account_drain",
                "description": (
                    f"Pengurasan saldo akun hampir total terdeteksi: {drain_ratio*100:.1f}% saldo ditarik (Rp {amount:,.2f} dari Rp {oldbalance_org:,.2f})."
                    if is_id
                    else f"Near-total account drain detected: {drain_ratio*100:.1f}% of balance withdrawn ({amount:,.2f} from {oldbalance_org:,.2f})."
                ),
            })
        elif drain_ratio >= 0.70 and amount >= 5000:
            pattern_penalty += 0.20
            signals.append({
                "name": "elevated_account_drain",
                "description": (
                    f"Pengurasan saldo akun tingkat tinggi terdeteksi: {drain_ratio*100:.1f}% saldo ditarik."
                    if is_id
                    else f"High account depletion detected: {drain_ratio*100:.1f}% of balance withdrawn."
                ),
            })
        elif drain_ratio >= 0.40 and amount >= 10000:
            pattern_penalty += 0.10
            signals.append({
                "name": "moderate_account_drain",
                "description": (
                    f"Pengurasan saldo akun tingkat sedang: {drain_ratio*100:.1f}% saldo ditarik."
                    if is_id
                    else f"Moderate account depletion: {drain_ratio*100:.1f}% of balance withdrawn."
                ),
            })

        # 2. Balance Discrepancies
        if abs(error_balance_org) > 1.0:
            disc_penalty = min(0.25, 0.12 + (abs(error_balance_org) / max(amount, 1.0)) * 0.12)
            pattern_penalty += disc_penalty
            signals.append({
                "name": "balance_discrepancy",
                "description": (
                    f"Ketidakcocokan saldo rekening pengirim ({error_balance_org:+,.2f}) menunjukkan status pembukuan buku besar yang anomali."
                    if is_id
                    else f"Origin balance mismatch ({error_balance_org:+,.2f}) indicates an anomalous ledger state."
                ),
            })

        if abs(error_balance_dest) > 1.0 and oldbalance_dest > 0:
            pattern_penalty += 0.10
            signals.append({
                "name": "dest_balance_discrepancy",
                "description": (
                    f"Ketidakcocokan saldo rekening penerima ({error_balance_dest:+,.2f}) menunjukkan pencatatan penyelesaian yang tidak teratur."
                    if is_id
                    else f"Destination balance mismatch ({error_balance_dest:+,.2f}) indicates irregular settlement tracking."
                ),
            })

        # 3. Amount Magnitude
        if amount >= 1_000_000:
            pattern_penalty += 0.25
            signals.append({
                "name": "ultra_high_value",
                "description": (
                    f"Jumlah transaksi (Rp {amount:,.2f}) melampaui batas ambang risiko sangat tinggi."
                    if is_id
                    else f"Transaction amount (Rp {amount:,.2f}) exceeds ultra-high risk threshold."
                ),
            })
        elif amount >= 200_000:
            pattern_penalty += 0.15
            signals.append({
                "name": "high_value_transaction",
                "description": (
                    f"Jumlah transaksi (Rp {amount:,.2f}) melampaui ambang batas operasional standar."
                    if is_id
                    else f"Transaction amount (Rp {amount:,.2f}) exceeds standard operational threshold."
                ),
            })
        elif amount >= 50_000:
            pattern_penalty += 0.08
        elif amount <= 10_000:
            pattern_penalty -= 0.05

        # 4. Repeated Payment Attempts
        if payment_attempts >= 3:
            pattern_penalty += 0.30
            signals.append({
                "name": "high_payment_attempts",
                "description": (
                    f"Terdeteksi beberapa kali percobaan pembayaran berulang ({payment_attempts} percobaan)."
                    if is_id
                    else f"Multiple repeated payment attempts detected ({payment_attempts} attempts)."
                ),
            })
        elif payment_attempts == 2:
            pattern_penalty += 0.15
            signals.append({
                "name": "repeated_payment_attempt",
                "description": (
                    "Percobaan pembayaran kedua terdeteksi setelah kegagalan transaksi awal."
                    if is_id
                    else "Secondary payment attempt detected after initial failure."
                ),
            })

        # 5. Transaction Type Risk
        if tx_type_normalized == "CASH_OUT":
            pattern_penalty += 0.08
        elif tx_type_normalized == "TRANSFER":
            pattern_penalty += 0.04
        elif tx_type_normalized in ("PAYMENT", "DEBIT", "CASH_IN"):
            pattern_penalty -= 0.05

        # 6. Check transaction velocity in Redis (sliding window of 60s)
        velocity = 1
        if check_velocity and account_id:
            velocity = check_transaction_velocity(str(account_id), window_seconds=60)
            if velocity > 3:
                pattern_penalty += 0.35
                signals.append({
                    "name": "high_velocity_burst",
                    "description": (
                        f"Lonjakan frekuensi transaksi tidak wajar terdeteksi: akun melakukan {velocity} transaksi dalam 60 detik."
                        if is_id
                        else f"Unusual velocity burst detected: account initiated {velocity} transactions within 60 seconds."
                    ),
                })

        # 7. Graph / Network Risk
        shared_devices = float(graph_features.get("shared_devices_count", 0.0) or 0.0)
        node_degree = float(graph_features.get("node_degree", 0.0) or 0.0)

        if shared_devices > 0:
            pattern_penalty += 0.20
            signals.append({
                "name": "shared_device_detected",
                "description": (
                    f"Akun terdeteksi menggunakan perangkat yang sama dengan entitas lain (jumlah entitas bersama: {int(shared_devices)})."
                    if is_id
                    else f"Account shares devices with other entities (shared count: {int(shared_devices)})."
                ),
            })
        if node_degree > 3:
            pattern_penalty += 0.10
            signals.append({
                "name": "high_network_degree",
                "description": (
                    f"Akun menunjukkan derajat koneksi tinggi ({int(node_degree)}) dalam graf jaringan transaksi."
                    if is_id
                    else f"Account exhibits high connection degree ({int(node_degree)}) in transaction graph."
                ),
            })

        # Synthesize composite risk score
        base_score = 0.05
        if raw_model_prob >= 0.70:
            composite_score = max(raw_model_prob, 0.75 + 0.24 * min(1.0, max(0.0, pattern_penalty)))
        else:
            composite_score = base_score + 0.45 * raw_model_prob + 0.75 * pattern_penalty

        risk_score = round(float(min(0.99, max(0.01, composite_score))), 4)

        decision, signals = self._apply_decision_policy(risk_score, signals, lang=lang)

        result = {
            "risk_score": risk_score,
            "decision": decision,
            "model_version": self.model_version,
            "signals": signals,
            "velocity": velocity,
            "graph_metrics": {
                "shared_devices_count": shared_devices,
                "node_degree": node_degree,
            },
        }
        return result

    def evaluate_risk(
        self,
        tx_data: dict,
        historical_transactions: list | None = None,
        check_velocity: bool = True,
    ) -> dict:
        return self.evaluate_transaction(
            tx_data,
            historical_transactions=historical_transactions,
            check_velocity=check_velocity,
        )

    def enrich_with_graph_features(self, account_id: str, transaction_history: list) -> dict:
        graph_analyzer.build_graph_from_transactions(transaction_history)
        return graph_analyzer.extract_graph_features(account_id)


risk_engine = RiskEngine()