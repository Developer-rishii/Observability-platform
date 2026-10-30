import json
from datetime import datetime, timezone
import numpy as np

def parse_iso(ts_str):
    if ts_str.endswith("Z"):
        ts_str = ts_str[:-1] + "+00:00"
    return datetime.fromisoformat(ts_str)

with open("ml/evaluation/runs.json", "r") as f:
    runs = json.load(f)

with open("ml/traces/detection_trace.jsonl", "r", encoding="utf-8") as f:
    traces = [json.loads(line) for line in f if line.strip()]

# Build precise fault + incident/breach streak + 6 min decay windows
fault_windows = []
for idx, r in enumerate(runs):
    r_start = parse_iso(r["start_utc"]).timestamp()
    r_end = parse_iso(r["end_utc"]).timestamp()
    next_start = parse_iso(runs[idx + 1]["start_utc"]).timestamp() if idx + 1 < len(runs) else float("inf")

    # Associate breaches with this run (from run start until next run)
    run_breaches = [
        t for t in traces
        if r_start <= parse_iso(t["timestamp"]).timestamp() < next_start
        and t.get("score") is not None
        and t.get("threshold") is not None
        and t["score"] >= t["threshold"]
    ]

    if run_breaches:
        streak_end = parse_iso(run_breaches[-1]["timestamp"]).timestamp()
        # Extend decay to cover the whole time the breach streak lasted plus 6 minutes (360 seconds)
        effective_end = max(r_end, streak_end) + 360
    else:
        effective_end = r_end + 360

    fault_windows.append({
        "run_id": r["run_id"],
        "scenario": r.get("scenario", r.get("type")),
        "start": r_start,
        "end": effective_end,
        "streak_len": len(run_breaches),
        "breaches": run_breaches,
    })

def classify_cycle(ts_val):
    for fw in fault_windows:
        if fw["start"] <= ts_val <= fw["end"]:
            return True, fw["run_id"]
    return False, None

normal_traces = []
fault_traces = []

for t in traces:
    ts = parse_iso(t["timestamp"]).timestamp()
    in_fault, run_id = classify_cycle(ts)
    if in_fault:
        fault_traces.append((t, run_id))
    else:
        normal_traces.append(t)

print("================================================================================")
print("GROUND-TRUTH RELABELED DETECTION TRACE ANALYSIS")
print("================================================================================")
print(f"Total Cycles:         {len(traces)}")
print(f"Relabeled Normal:     {len(normal_traces)}")
print(f"Relabeled Fault/Decay:{len(fault_traces)}")

thr = traces[-1]["threshold"]
norm_scores = [t["score"] for t in normal_traces if t.get("score") is not None]

print("\n--- Relabeled Clean Normal Periods Performance ---")
print(f"  Sample count:  {len(norm_scores)}")
print(f"  Min score:     {np.min(norm_scores):.4f}")
print(f"  Median score:  {np.median(norm_scores):.4f}")
print(f"  P95 score:     {np.percentile(norm_scores, 95):.4f}")
print(f"  P99.5 score:   {np.percentile(norm_scores, 99.5):.4f}")
print(f"  Max score:     {np.max(norm_scores):.4f}")
print(f"  Threshold:     {thr:.4f}")

normal_breaches = [t for t in normal_traces if t.get("score") is not None and t["score"] >= thr]
single_cycle_fa = len(normal_breaches)
cycle_far = (single_cycle_fa / len(norm_scores)) * 100.0 if norm_scores else 0.0
print(f"  Single-cycle false alarms (score >= threshold): {single_cycle_fa} ({cycle_far:.2f}%)")

incident_fa = sum(1 for t in normal_traces if t.get("decision") == "opened_incident")
print(f"  Incident-level false alarms: {incident_fa}")

print("\n================================================================================")
print("ALL SINGLE-CYCLE BREACHES & WINDOW ATTRIBUTION")
print("================================================================================")
all_breaches = [t for t in traces if t.get("score") is not None and t.get("threshold") is not None and t["score"] >= t["threshold"]]
print(f"Total breach cycles across entire trace: {len(all_breaches)}")
for b in all_breaches:
    ts_val = parse_iso(b["timestamp"]).timestamp()
    _, run_id = classify_cycle(ts_val)
    print(f"Timestamp: {b['timestamp']} | Score: {b['score']:.4f} | Threshold: {b['threshold']:.4f} | Breach Count: {b.get('breach_count')} | Decision: {b.get('decision')} | Assigned Window: {run_id}")

print("\n================================================================================")
print("CYCLES 17:59:00 - 17:59:30 VS INCIDENT #311 BREACH STREAK")
print("================================================================================")
streak_311_breaches = [t for t in traces if "2026-10-26T17:52:15" <= t["timestamp"] <= "2026-10-26T17:59:30" and t.get("breach_count", 0) > 0]
print(f"Incident #311 continuous breach streak duration: {len(streak_311_breaches)} cycles (from {streak_311_breaches[0]['timestamp']} to {streak_311_breaches[-1]['timestamp']})")
print("\nCycles 17:59:00 - 17:59:30 in that streak:")
for t in traces:
    if "2026-10-26T17:59:00" <= t["timestamp"] <= "2026-10-26T17:59:30":
        print(f"  Timestamp: {t['timestamp']} | Score: {t['score']:.4f} | Breach Count: {t.get('breach_count')} | Decision: {t.get('decision')}")
