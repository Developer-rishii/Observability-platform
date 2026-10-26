import pytest
from app.services.detection.threshold_checker import is_breach


def test_is_breach_above_threshold():
    """Value above threshold should return True."""
    assert is_breach(85.0, 80.0) is True


def test_is_breach_below_threshold():
    """Value below threshold should return False."""
    assert is_breach(50.0, 80.0) is False


def test_is_breach_exact_boundary():
    """Exact boundary (value == threshold) should return False strictly."""
    assert is_breach(80.0, 80.0) is False


def test_is_breach_floating_point_just_above():
    """Value slightly above threshold should return True."""
    assert is_breach(80.001, 80.0) is True


def test_is_breach_floating_point_just_below():
    """Value slightly below threshold should return False."""
    assert is_breach(79.999, 80.0) is False


def test_is_breach_negative_values():
    """Check negative values comparison."""
    assert is_breach(-10.0, -20.0) is True
    assert is_breach(-20.0, -10.0) is False
    assert is_breach(-15.0, -15.0) is False


def test_is_breach_zero_boundary():
    """Zero value and zero threshold should return False."""
    assert is_breach(0.0, 0.0) is False
    assert is_breach(0.1, 0.0) is True
    assert is_breach(-0.1, 0.0) is False


def test_is_breach_inverse():
    """Inverse breach tests where lower value is worse."""
    assert is_breach(40.0, 50.0, inverse=True) is True
    assert is_breach(60.0, 50.0, inverse=True) is False
    assert is_breach(50.0, 50.0, inverse=True) is False


def test_calculate_severity_normal_metrics():
    """Verify progressive severity mapping for standard metrics."""
    from app.services.detection.threshold_checker import calculate_severity

    threshold = 80.0
    # At or below threshold
    assert calculate_severity(80.0, threshold) == "medium"
    assert calculate_severity(75.0, threshold) == "medium"

    # Mild breach (just above threshold, ratio < 1.05)
    assert calculate_severity(81.0, threshold) == "medium"

    # High breach (ratio >= 1.05 and < 1.20)
    assert calculate_severity(85.0, threshold) == "high"
    assert calculate_severity(95.0, threshold) == "high"

    # Critical breach (ratio >= 1.20)
    assert calculate_severity(96.0, threshold) == "critical"
    assert calculate_severity(100.0, threshold) == "critical"


def test_calculate_severity_count_metrics():
    """Verify severity mapping for integer count signals."""
    from app.services.detection.threshold_checker import calculate_severity

    # Zero or 1 threshold
    assert calculate_severity(1.0, 0.0, is_count=True) == "high"
    assert calculate_severity(3.0, 0.0, is_count=True) == "critical"

    # Positive threshold
    assert calculate_severity(1.0, 1.0, is_count=True) == "medium"
    assert calculate_severity(2.0, 1.0, is_count=True) == "critical"  # ratio 2.0 >= 1.2
