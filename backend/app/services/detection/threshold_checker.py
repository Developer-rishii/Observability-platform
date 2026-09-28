def is_breach(value: float, threshold: float) -> bool:
    """Pure threshold breach checker.
    
    Returns True if value strictly exceeds threshold, False otherwise.
    """
    return value > threshold
