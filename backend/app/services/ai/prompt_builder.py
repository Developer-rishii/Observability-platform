"""
Prompt builder for AI root-cause analysis.

Turns an incident context dict (from incident_context.build_incident_context)
into a ready-to-send prompt string.
"""


def build_prompt(incident_context: dict) -> str:
    """
    Build a terse, structured prompt for a root-cause analysis request.

    The prompt asks the model to respond with ONLY valid JSON matching
    the RCAOut schema so we can parse it directly.
    """
    ctx = incident_context
    return f"""You are an expert Site Reliability Engineer analyzing a production incident.

INCIDENT DETAILS:
- ID: {ctx["incident_id"]}
- Title: {ctx["title"]}
- Affected Service: {ctx["affected_service"]}
- Affected Metric: {ctx["metric_name"]}
- Observed Value: {ctx["metric_value"]:.4f}
- Threshold: {ctx["threshold"]}
- Severity: {ctx["severity"]}
- Detected At: {ctx["detected_at"]}
- Description: {ctx["description"]}
- Affected Metrics: {", ".join(ctx.get("affected_metrics", []))}

Respond with ONLY valid JSON matching this exact schema (no markdown fences, no commentary):
{{
  "summary": "<one sentence summary of what happened>",
  "probable_cause": "<most likely root cause, 1-2 sentences>",
  "confidence": "low" | "medium" | "high",
  "next_steps": ["<action 1>", "<action 2>", "<action 3>"]
}}"""
