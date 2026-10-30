#!/usr/bin/env python3
"""Manual smoke test script for Ask AI Incident Chat (OpenAI).

Only executes if OPENAI_API_KEY is configured in the environment.
Usage:
    python scripts/chat_smoke.py --incident-id 356 --question "Why was this incident flagged?"
"""
import os
import sys
import argparse

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.incident import Incident
from app.services.ai.openai_chat import ChatProvider
from app.services.ai.chat_context_builder import build_chat_context, build_system_prompt


def run_smoke(incident_id: int, question: str):
    api_key = os.getenv("OPENAI_API_KEY", getattr(settings, "OPENAI_API_KEY", ""))
    if not api_key or api_key == "your_openai_api_key_here":
        print("[SKIPPED] OPENAI_API_KEY is not set or placeholder. Please set OPENAI_API_KEY to test against live OpenAI API.")
        return

    print(f"Connecting to database to load Incident #{incident_id}...")
    db = SessionLocal()
    try:
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            print(f"[ERROR] Incident #{incident_id} not found in database.")
            return

        print(f"Building chat context for Incident #{incident_id} ({incident.title})...")
        context_text, summary = build_chat_context(db, incident)
        print(f"Context Summary: {summary}")
        print(f"Context Length : ~{len(context_text)} characters (~{len(context_text)//4} tokens)")

        system_prompt = build_system_prompt(incident.id, context_text)
        provider = ChatProvider(api_key=api_key)

        print(f"\nSending question to {provider.model}: '{question}'...")
        messages = [{"role": "user", "content": question}]
        answer = provider.generate(system_prompt, messages)

        print("\n--- AI Assistant Response ---")
        print(answer)
        print("-----------------------------\n[SUCCESS] Smoke test completed successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ask AI Chat Smoke Test")
    parser.add_argument("--incident-id", type=int, default=356, help="Target incident ID")
    parser.add_argument("--question", type=str, default="Why was this flagged?", help="Test question")
    args = parser.parse_args()

    run_smoke(args.incident_id, args.question)
