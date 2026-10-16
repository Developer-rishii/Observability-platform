from typing import Literal

SeverityLevel = Literal["critical", "high", "medium", "low", "info"]


def is_breach(value: float, threshold: float, inverse: bool = False) -> bool:
    """Pure threshold breach checker.
    
    If inverse is False (default): returns True if value strictly exceeds threshold (value > threshold).
    If inverse is True: returns True if value strictly falls below threshold (value < threshold).
    """
    if inverse:
        return value < threshold
    return value > threshold


def calculate_severity(
    value: float,
    threshold: float,
    inverse: bool = False,
    is_count: bool = False,
) -> SeverityLevel:
    """Calculate incident severity based on how far the observed value breaches the threshold.

    Conventions:
    - critical: value > 1.2 * threshold (ratio > 1.20)
    - high:     value > 1.0 * threshold (ratio > 1.00)
    - If at or below threshold: returns 'medium' (fallback baseline severity)

    For integer count metrics (e.g. restart counts with threshold 0 or 1):
    - critical: breach margin >= 3 (e.g. >= 4 restarts if threshold 1)
    - high: breach margin >= 1 (e.g. >= 2 restarts)
    - medium: baseline breach
    """
    if threshold <= 0:
        if value > threshold:
            return "critical" if value >= 3 else "high"
        return "medium"

    if inverse:
        # Lower is worse (e.g. free disk space or availability)
        if value >= threshold:
            return "medium"
        ratio = value / threshold  # e.g., 0.5 is severe
        if ratio <= 0.8:
            return "critical"
        return "high"

    # Higher is worse (standard telemetry)
    if value <= threshold:
        return "medium"

    ratio = value / threshold
    if ratio >= 1.20:
        return "critical"
    elif ratio >= 1.05:
        return "high"
    else:
        return "medium"
