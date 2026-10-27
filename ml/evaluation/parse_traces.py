"""Trace analysis script for detection_trace.jsonl.

Separates cycles into normal baseline periods vs fault injection periods,
computing score distributions, cycle-level false alarm rates, and incident-level alerts.
"""
import json
import numpy as np


def parse_trace(trace_path="ml/traces/detection_trace.jsonl"):
    with open(trace_path, "r", encoding="utf-8") as f:
        records = [json.loads(line) for line in f if line.strip()]
    return records


def analyze_traces():
    records = parse_trace()
    print("================================================================================")
    print("STEP 2: PARSING ml/traces/detection_trace.jsonl")
    print("================================================================================")
    print(f"Total cycles recorded: {len(records)}")

    # Classify cycles based on features and decision
    # Normal period: container_die_count_15m <= 1, cpu_pct_mean_5m < 15, latency_p95_mean_5m < 0.05
    # Fault period: elevated metrics (latency > 0.05 or cpu > 15 or decision in [breach_count_1, breach_count_2, opened_incident, breach_duplicate_prevented])
    normal_cycles = []
    fault_cycles = []

    for r in records:
        feat = r.get("features")
        decision = r.get("decision", "")
        if not feat:
            continue
        
        is_fault = (
            feat.get("cpu_pct_mean_5m", 0) > 15.0 or
            feat.get("latency_p95_mean_5m", 0) > 0.05 or
            "breach" in decision or
            decision == "opened_incident"
        )
        if is_fault:
            fault_cycles.append(r)
        else:
            normal_cycles.append(r)

    print(f"Normal traffic cycles: {len(normal_cycles)}")
    print(f"Fault/Stress cycles:   {len(fault_cycles)}")

    # 1. Normal period metrics
    norm_scores = [r["score"] for r in normal_cycles if r.get("score") is not None]
    thr = records[-1]["threshold"]

    print("\n--- Normal Periods Performance ---")
    print(f"  Sample count:  {len(norm_scores)}")
    print(f"  Min score:     {np.min(norm_scores):.4f}")
    print(f"  Median score:  {np.median(norm_scores):.4f}")
    print(f"  P95 score:     {np.percentile(norm_scores, 95):.4f}")
    print(f"  P99.5 score:   {np.percentile(norm_scores, 99.5):.4f}")
    print(f"  Max score:     {np.max(norm_scores):.4f}")
    print(f"  Threshold:     {thr:.4f}")

    norm_breaches = [r for r in normal_cycles if r.get("score", 0) >= thr]
    cycle_far = (len(norm_breaches) / len(norm_scores)) * 100.0 if norm_scores else 0.0
    print(f"  Single-cycle false alarms (score >= threshold): {len(norm_breaches)} ({cycle_far:.2f}%)")

    incident_opens_normal = [r for r in normal_cycles if r.get("decision") == "opened_incident"]
    print(f"  Incident-level false alarms (3 consecutive breaches): {len(incident_opens_normal)}")

    # 2. Fault period metrics
    fault_scores = [r["score"] for r in fault_cycles if r.get("score") is not None]
    print("\n--- Fault Injection Periods Performance ---")
    print(f"  Sample count:  {len(fault_scores)}")
    print(f"  Min score:     {np.min(fault_scores):.4f}")
    print(f"  Median score:  {np.median(fault_scores):.4f}")
    print(f"  P95 score:     {np.percentile(fault_scores, 95):.4f}")
    print(f"  P99.5 score:   {np.percentile(fault_scores, 99.5):.4f}")
    print(f"  Max score:     {np.max(fault_scores):.4f}")

    fault_breaches = [r for r in fault_cycles if r.get("score", 0) >= thr]
    fault_tpr = (len(fault_breaches) / len(fault_scores)) * 100.0 if fault_scores else 0.0
    print(f"  Cycles >= threshold during faults: {len(fault_breaches)}/{len(fault_scores)} ({fault_tpr:.2f}%)")
    
    incident_opens_fault = [r for r in fault_cycles if r.get("decision") == "opened_incident"]
    print(f"  Incidents created during faults: {len(incident_opens_fault)}")

    # 3. Detailed trace breakdown around incident creation
    print("\n--- Consecutive Cycles During Latency Fault Incident Creation ---")
    for r in fault_cycles:
        if "breach" in r.get("decision", "") or r.get("decision") == "opened_incident":
            print(f"  Timestamp: {r['timestamp']} | Score: {r['score']:.4f} | Breach Count: {r['breach_count']} | Decision: {r['decision']}")


if __name__ == "__main__":
    analyze_traces()
