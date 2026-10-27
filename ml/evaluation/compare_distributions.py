import json
import pandas as pd

# Load train dataset
df_train = pd.read_csv("ml/data/normal_train.csv")

# Load normal trace feature vectors from detection_trace.jsonl
with open("ml/traces/detection_trace.jsonl", "r", encoding="utf-8") as f:
    traces = [json.loads(line) for line in f if line.strip()]

normal_traces = [
    t["features"] for t in traces 
    if t.get("features") is not None and "breach" not in t.get("decision", "") and t.get("decision") != "opened_incident"
]
df_live = pd.DataFrame(normal_traces)

print(f"Comparing Training ({len(df_train)} rows) vs. Live Normal Traces ({len(df_live)} rows):\n")
print(f"{'Feature':<26} | {'Train Min':<10} | {'Train Max':<10} | {'Live Min':<10} | {'Live Max':<10} | {'Outside Range?'}")
print("-" * 95)

for feat in df_train.columns:
    if feat == "timestamp":
        continue
    tr_min = df_train[feat].min()
    tr_max = df_train[feat].max()
    lv_min = df_live[feat].min()
    lv_max = df_live[feat].max()

    outside = []
    if lv_min < tr_min:
        outside.append(f"below (live min {lv_min:.4f} < train min {tr_min:.4f})")
    if lv_max > tr_max:
        outside.append(f"above (live max {lv_max:.4f} > train max {tr_max:.4f})")

    flag = "YES: " + ", ".join(outside) if outside else "NO (within range)"
    print(f"{feat:<26} | {tr_min:<10.4f} | {tr_max:<10.4f} | {lv_min:<10.4f} | {lv_max:<10.4f} | {flag}")
