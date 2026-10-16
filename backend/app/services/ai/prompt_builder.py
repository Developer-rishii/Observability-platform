"""
Prompt builder for AI root-cause analysis.

Turns an incident context dict (from incident_context.build_incident_context)
into a ready-to-send prompt string.
"""


def build_prompt(incident_context: dict) -> str:
    """
    Build a structured prompt for a root-cause analysis request.

    The prompt asks the model to respond with ONLY valid JSON matching
    the RCAOut schema so we can parse it directly.
    """
    ctx = incident_context
    affected_metrics_str = ", ".join(ctx.get("affected_metrics", [])) or "none specified"
    return f"""You are an expert Site Reliability Engineer performing a structured root-cause analysis (RCA) for a production incident.

INCIDENT DETAILS:
- ID: {ctx["incident_id"]}
- Title: {ctx["title"]}
- Affected Service: {ctx["affected_service"]}
- Primary Metric: {ctx["metric_name"]}
- Observed Value: {ctx["metric_value"]:.4f}
- Threshold Breached: {ctx["threshold"]}
- Severity: {ctx["severity"]}
- Detected At: {ctx["detected_at"]}
- Description: {ctx["description"]}
- Correlated Affected Metrics: {affected_metrics_str}

Your task is to produce a structured, evidence-based RCA report. Respond with ONLY valid JSON matching this exact schema (no markdown fences, no commentary, no trailing commas):
{{
  "summary": "<one-sentence summary of the incident impact>",
  "probable_cause": "<the single most likely root cause, 1-2 sentences>",
  "confidence": "low",
  "supporting_evidence": [
    {{"text": "<a specific observed fact that supports this root cause>", "ref": null}},
    {{"text": "<another supporting observation>", "ref": null}}
  ],
  "affected_components": ["<component 1>", "<component 2>"],
  "impact": "<concise description of the business and technical impact>",
  "recommended_investigation": [
    "<specific verification step 1>",
    "<specific verification step 2>",
    "<specific verification step 3>"
  ],
  "possible_remediation": [
    "<advisory remediation action 1 — implement only with approval>",
    "<advisory remediation action 2>"
  ],
  "alternative_causes": [
    "<alternative hypothesis 1 that could explain the incident>",
    "<alternative hypothesis 2>"
  ]
}}

IMPORTANT: Set confidence to \"low\", \"medium\", or \"high\" based on the strength of evidence available. All remediation suggestions are advisory only and must not be executed without explicit human approval and an authorized change process."""
