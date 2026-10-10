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
