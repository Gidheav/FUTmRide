"""Campus and period scoping for reports."""
from __future__ import annotations

from apps.payments.admin_finance import VALID_PERIODS, _period_bounds, _resolve_campus


def resolve_scope(user, period: str = '30D'):
    period = period if period in VALID_PERIODS else '30D'
    campus = _resolve_campus(user)
    start, end = _period_bounds(period)
    return campus, start, end, period
