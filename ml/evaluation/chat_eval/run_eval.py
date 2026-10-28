#!/usr/bin/env python3
"""Run evaluation question set against stored incidents via the backend chat API.

Only runs when explicitly called by the user.
Saves question/answer/latency/token counts to JSON and generates a Markdown table
with an empty 'Human Rating (correct / partial / wrong)' column for manual grading.
"""
import os
import sys
import time
import json
import argparse
import requests
from typing import List, Dict, Any

# Ensure backend can be imported for direct context testing if needed
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend"))


def run_evaluation(
    api_base: str,
    token: str,
    incident_map: Dict[str, int],
    questions_file: str,
    output_dir: str,
):
    if not os.path.exists(questions_file):
        print(f"[ERROR] Questions file not found at {questions_file}")
        return

    with open(questions_file, "r", encoding="utf-8") as f:
        scenarios = json.load(f)

    os.makedirs(output_dir, exist_ok=True)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    eval_results: List[Dict[str, Any]] = []

    print(f"Starting Ask AI Chat Evaluation against {api_base}...")
    for sc in scenarios:
        sc_id = sc.get("scenario")
        target_incident_id = incident_map.get(sc_id, incident_map.get("default", 356))
        print(f"\nScenario: {sc_id} (Incident #{target_incident_id})")

        for q in sc.get("questions", []):
            qid = q.get("id")
            qtext = q.get("text")
            print(f"  [{qid}] Q: {qtext}")

            payload = {
                "message": qtext,
                "history": [],
            }
            start_t = time.time()
            try:
                resp = requests.post(
                    f"{api_base}/api/v1/ai/incidents/{target_incident_id}/chat",
                    headers=headers,
                    json=payload,
                    timeout=30,
                )
                latency_sec = round(time.time() - start_t, 2)
                if resp.status_code == 200:
                    data = resp.json()
                    answer = data.get("answer", "")
                    context_summary = data.get("contextSummary", "")
                    approx_tokens = len(answer) // 4
                    eval_results.append({
                        "scenario": sc_id,
                        "incident_id": target_incident_id,
                        "question_id": qid,
                        "question": qtext,
                        "answer": answer,
                        "latency_sec": latency_sec,
                        "approx_tokens": approx_tokens,
                        "context_summary": context_summary,
                        "status": "success",
                    })
                    print(f"      Ans ({latency_sec}s, ~{approx_tokens} tok): {answer[:120]}...")
                else:
                    eval_results.append({
                        "scenario": sc_id,
                        "incident_id": target_incident_id,
                        "question_id": qid,
                        "question": qtext,
                        "answer": f"HTTP {resp.status_code}: {resp.text}",
                        "latency_sec": latency_sec,
                        "approx_tokens": 0,
                        "context_summary": "error",
                        "status": f"http_{resp.status_code}",
                    })
                    print(f"      [FAIL] HTTP {resp.status_code}: {resp.text}")
            except Exception as exc:
                latency_sec = round(time.time() - start_t, 2)
                eval_results.append({
                    "scenario": sc_id,
                    "incident_id": target_incident_id,
                    "question_id": qid,
                    "question": qtext,
                    "answer": f"Error: {exc}",
                    "latency_sec": latency_sec,
                    "approx_tokens": 0,
                    "context_summary": "error",
                    "status": "exception",
                })
                print(f"      [EXCEPTION] {exc}")

            # Sleep 2.5s between requests to respect rate limiting
            time.sleep(2.5)

    # 1. Save JSON results
    json_path = os.path.join(output_dir, "eval_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(eval_results, f, indent=2)
    print(f"\n[SUCCESS] Saved JSON evaluation results to {json_path}")

    # 2. Save Markdown table with human rating column
    md_path = os.path.join(output_dir, "eval_report.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# Ask AI Incident Chat Evaluation Report\n\n")
        f.write(f"Generated at: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n\n")
        f.write("| Scenario | QID | Question | AI Answer Snippet | Latency (s) | Tokens | Context Used | Human Rating (correct / partial / wrong) |\n")
        f.write("|---|---|---|---|---|---|---|---|\n")
        for r in eval_results:
            clean_ans = r["answer"].replace("\n", " ").replace("|", "\\|")[:140]
            clean_q = r["question"].replace("|", "\\|")
            f.write(f"| {r['scenario']} | {r['question_id']} | {clean_q} | {clean_ans}... | {r['latency_sec']} | {r['approx_tokens']} | {r['context_summary']} |  |\n")

    print(f"[SUCCESS] Saved Markdown grading report to {md_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Ask AI Chat Evaluation")
    parser.add_argument("--api-base", default="http://localhost:8000", help="FastAPI backend base URL")
    parser.add_argument("--token", required=True, help="JWT access token for authentication")
    parser.add_argument("--questions", default="ml/evaluation/chat_eval/questions.json", help="Path to questions.json")
    parser.add_argument("--out-dir", default="ml/evaluation/chat_eval/results", help="Directory to save evaluation reports")
    parser.add_argument("--ml-latency-id", type=int, default=356, help="Incident ID for ML latency scenario")
    parser.add_argument("--ml-cpu-id", type=int, default=356, help="Incident ID for ML CPU scenario")
    parser.add_argument("--rule-id", type=int, default=351, help="Incident ID for Rule Guard scenario")

    args = parser.parse_args()

    inc_map = {
        "ml_latency": args.ml_latency_id,
        "ml_cpu": args.ml_cpu_id,
        "rule_incident": args.rule_id,
        "cross_scenario_boundaries": args.ml_latency_id,
        "default": args.ml_latency_id,
    }

    run_evaluation(args.api_base, args.token, inc_map, args.questions, args.out_dir)
