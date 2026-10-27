"""Offline evaluation script for isolation forest anomaly detector.

Performs:
1. Synthetic perturbation testing across all 8 features at varying magnitudes.
2. Detection rate, ROC-AUC, and score distribution analysis.
3. Random seed stability analysis across seeds [0, 1, 7, 42, 123].
"""
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_auc_score


def load_artifacts():
    model = joblib.load("ml/models/isolation_forest.pkl")
    with open("ml/models/feature_metadata.json", "r") as f:
        meta = json.load(f)
    df_val = pd.read_csv("ml/data/normal_validate.csv")
    df_train = pd.read_csv("ml/data/normal_train.csv")
    return model, meta, df_val, df_train


def score_samples(model, X_df, feature_names):
    X = X_df[feature_names].values
    return -model.score_samples(X)


def run_evaluation():
    model, meta, df_val, df_train = load_artifacts()
    feature_names = meta["features"]
    threshold = meta["threshold"]
    means = meta["feature_means"]

    print("================================================================================")
    print("STEP 1: OFFLINE EVALUATION ON VALIDATION DATA & SYNTHETIC PERTURBATIONS")
    print("================================================================================")
    print(f"Model Version: {meta.get('model_version')}")
    print(f"Calibrated Threshold: {threshold:.4f} (Validation P99.5: {meta.get('threshold_p99_5', 0.0):.4f} + 0.02)")
    print(f"Validation Samples: {len(df_val)}")

    # 1. Base normal validation scores
    normal_scores = score_samples(model, df_val, feature_names)
    print("\n--- Normal Validation Score Distribution ---")
    print(f"  Min:    {np.min(normal_scores):.4f}")
    print(f"  Median: {np.median(normal_scores):.4f}")
    print(f"  P95:    {np.percentile(normal_scores, 95):.4f}")
    print(f"  P99.5:  {np.percentile(normal_scores, 99.5):.4f}")
    print(f"  Max:    {np.max(normal_scores):.4f}")
    normal_breaches = np.sum(normal_scores >= threshold)
    print(f"  False Alarms: {normal_breaches}/{len(normal_scores)} ({normal_breaches/len(normal_scores)*100:.2f}%)")

    # 2. Perturbation experiments
    # For general continuous features: 2x, 3x, 5x mean
    # Special: die_count 1, 2, 3; error_rate 5, 10, 20%; data_dir_growth 10MB, 50MB, 100MB
    perturbations = {
        "cpu_pct_mean_5m": [("2x mean", means["cpu_pct_mean_5m"] * 2), ("3x mean", means["cpu_pct_mean_5m"] * 3), ("5x mean", means["cpu_pct_mean_5m"] * 5)],
        "cpu_pct_std_5m": [("2x mean", means["cpu_pct_std_5m"] * 2), ("3x mean", means["cpu_pct_std_5m"] * 3), ("5x mean", means["cpu_pct_std_5m"] * 5)],
        "latency_p95_mean_5m": [("2x mean", means["latency_p95_mean_5m"] * 2), ("3x mean", means["latency_p95_mean_5m"] * 3), ("5x mean", means["latency_p95_mean_5m"] * 5)],
        "latency_p95_std_5m": [("2x mean", means["latency_p95_std_5m"] * 2), ("3x mean", means["latency_p95_std_5m"] * 3), ("5x mean", means["latency_p95_std_5m"] * 5)],
        "error_rate_5m": [("5%", 5.0), ("10%", 10.0), ("20%", 20.0)],
        "request_rate_mean_5m": [("2x mean", means["request_rate_mean_5m"] * 2), ("3x mean", means["request_rate_mean_5m"] * 3), ("0.2x mean (drop)", means["request_rate_mean_5m"] * 0.2)],
        "container_die_count_15m": [("1 count", 1.0), ("2 count", 2.0), ("3 count", 3.0)],
        "data_dir_growth_5m": [("10MB", 10485760.0), ("50MB", 52428800.0), ("100MB", 104857600.0)],
    }

    print("\n--- Synthetic Anomaly Injection & Detection Rates ---")
    print(f"{'Feature':<26} | {'Magnitude':<16} | {'Mean Score':<10} | {'Max Score':<10} | {'Det Rate (>= thr)':<18}")
    print("-" * 90)

    all_injected_scores = []
    all_injected_labels = []

    for feat, variants in perturbations.items():
        for label, val in variants:
            df_pert = df_val.copy()
            df_pert[feat] = val
            scores = score_samples(model, df_pert, feature_names)
            det_rate = np.mean(scores >= threshold) * 100.0
            print(f"{feat:<26} | {label:<16} | {np.mean(scores):<10.4f} | {np.max(scores):<10.4f} | {det_rate:<6.1f}%")
            all_injected_scores.extend(scores.tolist())
            all_injected_labels.extend([1] * len(scores))

    # Calculate overall ROC-AUC (Normal Validation vs. All Injected)
    y_true = [0] * len(normal_scores) + all_injected_labels
    y_scores = normal_scores.tolist() + all_injected_scores
    auc = roc_auc_score(y_true, y_scores)
    
    injected_arr = np.array(all_injected_scores)
    print("\n--- Overall Injected Score Distribution ---")
    print(f"  Min:     {np.min(injected_arr):.4f}")
    print(f"  Median:  {np.median(injected_arr):.4f}")
    print(f"  P95:     {np.percentile(injected_arr, 95):.4f}")
    print(f"  P99.5:   {np.percentile(injected_arr, 99.5):.4f}")
    print(f"  Max:     {np.max(injected_arr):.4f}")
    print(f"\nOverall ROC-AUC (Normal vs. Injected): {auc:.4f}")

    # 3. Random seed stability evaluation
    print("\n================================================================================")
    print("STEP 2: RANDOM SEED STABILITY EVALUATION (normal_train.csv)")
    print("================================================================================")
    print(f"{'Seed':<8} | {'P99.5 Val':<12} | {'Calibrated Thr':<16} | {'Overall Injected Det Rate':<25}")
    print("-" * 70)

    seeds = [0, 1, 7, 42, 123]
    X_train = df_train[feature_names].values
    X_val = df_val[feature_names].values

    for seed in seeds:
        temp_model = IsolationForest(
            n_estimators=150,
            max_samples="auto",
            contamination="auto",
            random_state=seed,
        )
        temp_model.fit(X_train)
        val_s = -temp_model.score_samples(X_val)
        p99_5 = float(np.percentile(val_s, 99.5))
        cal_thr = p99_5 + 0.02

        # Evaluate on all injected perturbations
        seed_injected_scores = []
        for feat, variants in perturbations.items():
            for label, val in variants:
                df_pert = df_val.copy()
                df_pert[feat] = val
                scores = -temp_model.score_samples(df_pert[feature_names].values)
                seed_injected_scores.extend(scores.tolist())

        seed_det_rate = np.mean(np.array(seed_injected_scores) >= cal_thr) * 100.0
        print(f"{seed:<8} | {p99_5:<12.4f} | {cal_thr:<16.4f} | {seed_det_rate:<6.2f}%")


if __name__ == "__main__":
    run_evaluation()
