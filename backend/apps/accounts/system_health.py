from __future__ import annotations

import hashlib
import logging
from statistics import mean
from typing import Any

import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger("apps.accounts.system_health")

UPTIMEROBOT_URL = "https://api.uptimerobot.com/v2/getMonitors"
CRON_JOB_ORG_URL = "https://api.cron-job.org/jobs"

UPTIMEROBOT_STATUS_LABELS = {
    0: "Paused",
    1: "Not checked yet",
    2: "Up",
    8: "Seems down",
    9: "Down",
}

CRON_JOB_STATUS_LABELS = {
    0: "Unknown / not executed yet",
    1: "OK",
    2: "Failed (DNS error)",
    3: "Failed (could not connect to host)",
    4: "Failed (HTTP error)",
    5: "Failed (timeout)",
    6: "Failed (too much response data)",
    7: "Failed (invalid URL)",
    8: "Failed (internal errors)",
    9: "Failed (unknown reason)",
}

UPTIMEROBOT_DOWN_STATUSES = {8, 9}
UPTIMEROBOT_PENDING_STATUSES = {0, 1}
CRON_JOB_FAILED_STATUSES = {2, 3, 4, 5, 6, 7, 8, 9}


def get_system_health_report(force_refresh: bool = False) -> dict[str, Any]:
    cache_key = _cache_key()
    if not force_refresh:
        cached = cache.get(cache_key)
        if cached:
            return cached

    uptime_robot = _fetch_uptimerobot_report()
    cron_job_org = _fetch_cron_job_org_report()
    generated_at = timezone.now().isoformat()

    report = {
        "generated_at": generated_at,
        "cache_ttl_seconds": _cache_ttl(),
        "overall": _build_overall_status([uptime_robot, cron_job_org], generated_at),
        "uptime_robot": uptime_robot,
        "cron_job_org": cron_job_org,
    }
    cache.set(cache_key, report, timeout=_cache_ttl())
    return report


def _fetch_uptimerobot_report() -> dict[str, Any]:
    api_key = str(getattr(settings, "UPTIMEROBOT_API_KEY", "") or "").strip()
    monitor_ids = _setting_list("UPTIMEROBOT_MONITOR_IDS")

    base = {
        "provider": "UptimeRobot",
        "configured": bool(api_key),
        "status": "unconfigured",
        "summary": "Set UPTIMEROBOT_API_KEY in backend .env.",
        "items": [],
        "checked_at": timezone.now().isoformat(),
    }
    if not api_key:
        return base

    try:
        payload: dict[str, Any] = {
            "api_key": api_key,
            "format": "json",
            "custom_uptime_ratios": "1-7-30",
            "response_times": "1",
            "limit": 50,
        }
        if monitor_ids:
            payload["monitors"] = "-".join(monitor_ids)

        response = requests.post(
            UPTIMEROBOT_URL,
            data=payload,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Cache-Control": "no-cache",
            },
            timeout=_request_timeout(),
        )
        response.raise_for_status()
        body = response.json()
    except requests.Timeout:
        logger.warning("uptimerobot_report_timeout")
        return _provider_unavailable(base, "UptimeRobot request timed out.")
    except requests.RequestException as exc:
        logger.warning("uptimerobot_report_failed", exc_info=True)
        return _provider_unavailable(base, _request_error_summary(exc))
    except ValueError:
        logger.warning("uptimerobot_report_invalid_json", exc_info=True)
        return _provider_unavailable(base, "UptimeRobot returned an invalid JSON response.")

    if body.get("stat") != "ok":
        return _provider_unavailable(base, "UptimeRobot returned a failed API status.")

    monitors = body.get("monitors") or []
    items: list[dict[str, Any]] = []
    uptime_ratios: list[float] = []
    response_times: list[float] = []
    down_count = 0
    pending_count = 0

    for monitor in monitors:
        status_code = _as_int(monitor.get("status"), default=1)
        if status_code in UPTIMEROBOT_DOWN_STATUSES:
            down_count += 1
        elif status_code in UPTIMEROBOT_PENDING_STATUSES:
            pending_count += 1

        uptime_24h = _first_ratio(monitor.get("custom_uptime_ratios"))
        if uptime_24h is not None:
            uptime_ratios.append(uptime_24h)

        avg_response = _as_float(monitor.get("average_response_time"))
        if avg_response is not None:
            response_times.append(avg_response)

        items.append({
            "id": monitor.get("id"),
            "name": monitor.get("friendly_name") or "Monitor",
            "status": _uptimerobot_status_key(status_code),
            "status_label": UPTIMEROBOT_STATUS_LABELS.get(status_code, "Unknown"),
            "uptime_ratio_24h": uptime_24h,
            "average_response_ms": avg_response,
        })

    total = len(items)
    up_count = sum(1 for item in items if item["status"] == "operational")
    status_key = "operational"
    if total == 0:
        status_key = "degraded"
        summary = "No UptimeRobot monitors were returned."
    elif down_count:
        status_key = "down"
        summary = f"{down_count} of {total} monitors are down."
    elif pending_count:
        status_key = "degraded"
        summary = f"{pending_count} of {total} monitors are paused or waiting for checks."
    else:
        summary = f"{up_count} of {total} monitors are up."

    base.update({
        "status": status_key,
        "summary": summary,
        "monitors_total": total,
        "monitors_up": up_count,
        "monitors_down": down_count,
        "uptime_ratio_24h": _round(mean(uptime_ratios)) if uptime_ratios else None,
        "average_response_ms": _round(mean(response_times), 0) if response_times else None,
        "items": items,
        "rate_limit": {
            "limit": response.headers.get("X-RateLimit-Limit"),
            "remaining": response.headers.get("X-RateLimit-Remaining"),
            "reset": response.headers.get("X-RateLimit-Reset"),
        },
    })
    return base


def _fetch_cron_job_org_report() -> dict[str, Any]:
    api_key = str(getattr(settings, "CRON_JOB_ORG_API_KEY", "") or "").strip()
    configured_job_ids = set(_setting_list("CRON_JOB_ORG_JOB_IDS"))

    base = {
        "provider": "cron-job.org",
        "configured": bool(api_key),
        "status": "unconfigured",
        "summary": "Set CRON_JOB_ORG_API_KEY in backend .env.",
        "items": [],
        "checked_at": timezone.now().isoformat(),
    }
    if not api_key:
        return base

    try:
        response = requests.get(
            CRON_JOB_ORG_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=_request_timeout(),
        )
        response.raise_for_status()
        body = response.json()
    except requests.Timeout:
        logger.warning("cron_job_org_report_timeout")
        return _provider_unavailable(base, "cron-job.org request timed out.")
    except requests.RequestException as exc:
        logger.warning("cron_job_org_report_failed", exc_info=True)
        return _provider_unavailable(base, _request_error_summary(exc))
    except ValueError:
        logger.warning("cron_job_org_report_invalid_json", exc_info=True)
        return _provider_unavailable(base, "cron-job.org returned an invalid JSON response.")

    jobs = body.get("jobs") or []
    if configured_job_ids:
        jobs = [job for job in jobs if str(job.get("jobId")) in configured_job_ids]

    items: list[dict[str, Any]] = []
    durations: list[float] = []
    failed_count = 0
    unknown_count = 0
    ok_count = 0
    disabled_count = 0
    last_execution: int | None = None
    next_execution: int | None = None

    for job in jobs:
        status_code = _as_int(job.get("lastStatus"), default=0)
        enabled = bool(job.get("enabled"))
        if not enabled:
            disabled_count += 1
        elif status_code == 1:
            ok_count += 1
        elif status_code in CRON_JOB_FAILED_STATUSES:
            failed_count += 1
        else:
            unknown_count += 1

        duration = _as_float(job.get("lastDuration"))
        if duration is not None:
            durations.append(duration)

        last_execution = _max_timestamp(last_execution, job.get("lastExecution"))
        next_execution = _min_timestamp(next_execution, job.get("nextExecution"))

        items.append({
            "id": job.get("jobId"),
            "name": job.get("title") or "Cron job",
            "enabled": enabled,
            "status": _cron_job_status_key(status_code, enabled),
            "status_label": CRON_JOB_STATUS_LABELS.get(status_code, "Unknown"),
            "last_duration_ms": duration,
            "last_execution": _as_int(job.get("lastExecution")),
            "next_execution": _as_int(job.get("nextExecution")),
        })

    total = len(items)
    some_failed = bool(body.get("someFailed"))
    if total == 0:
        status_key = "degraded"
        summary = "No cron-job.org jobs were returned."
    elif some_failed or failed_count:
        status_key = "down" if ok_count == 0 and failed_count > 0 else "degraded"
        summary = f"{failed_count} of {total} cron jobs failed their last run."
    elif unknown_count:
        status_key = "degraded"
        summary = f"{unknown_count} of {total} cron jobs have not reported a clean run yet."
    elif disabled_count == total:
        status_key = "paused"
        summary = "All cron-job.org jobs are disabled."
    else:
        status_key = "operational"
        summary = f"{ok_count} of {total} enabled cron jobs are OK."

    base.update({
        "status": status_key,
        "summary": summary,
        "jobs_total": total,
        "jobs_ok": ok_count,
        "jobs_failed": failed_count,
        "jobs_disabled": disabled_count,
        "jobs_unknown": unknown_count,
        "average_duration_ms": _round(mean(durations), 0) if durations else None,
        "last_execution": last_execution,
        "next_execution": next_execution,
        "some_failed": some_failed,
        "items": items,
    })
    return base


def _build_overall_status(providers: list[dict[str, Any]], checked_at: str) -> dict[str, Any]:
    configured = [provider for provider in providers if provider.get("configured")]
    if not configured:
        return {
            "status": "unconfigured",
            "summary": "Monitoring providers are waiting for .env API keys.",
            "checked_at": checked_at,
        }

    provider_statuses = [provider.get("status") for provider in providers]
    if "down" in provider_statuses:
        status_key = "down"
        summary = "One or more monitored systems need attention."
    elif any(status in {"degraded", "unavailable", "paused"} for status in provider_statuses):
        status_key = "degraded"
        summary = "System health is partially degraded."
    elif "unconfigured" in provider_statuses:
        status_key = "degraded"
        summary = "Some monitoring providers still need .env keys."
    else:
        status_key = "operational"
        summary = "All monitored systems are operational."

    return {
        "status": status_key,
        "summary": summary,
        "checked_at": checked_at,
    }


def _provider_unavailable(base: dict[str, Any], summary: str) -> dict[str, Any]:
    base.update({
        "status": "unavailable",
        "summary": summary,
        "error": summary,
    })
    return base


def _request_error_summary(exc: requests.RequestException) -> str:
    response = getattr(exc, "response", None)
    if response is not None:
        return f"Provider API request failed with HTTP {response.status_code}."
    return "Provider API request failed."


def _uptimerobot_status_key(status_code: int | None) -> str:
    if status_code == 2:
        return "operational"
    if status_code in UPTIMEROBOT_DOWN_STATUSES:
        return "down"
    if status_code == 0:
        return "paused"
    return "pending"


def _cron_job_status_key(status_code: int | None, enabled: bool) -> str:
    if not enabled:
        return "paused"
    if status_code == 1:
        return "operational"
    if status_code in CRON_JOB_FAILED_STATUSES:
        return "down"
    return "pending"


def _cache_key() -> str:
    raw = "|".join([
        str(getattr(settings, "UPTIMEROBOT_API_KEY", "") or ""),
        ",".join(_setting_list("UPTIMEROBOT_MONITOR_IDS")),
        str(getattr(settings, "CRON_JOB_ORG_API_KEY", "") or ""),
        ",".join(_setting_list("CRON_JOB_ORG_JOB_IDS")),
    ])
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    return f"accounts:system-health:{digest}"


def _setting_list(name: str) -> list[str]:
    raw = getattr(settings, name, [])
    if isinstance(raw, str):
        values = raw.replace(";", ",").split(",")
    else:
        values = raw
    return [str(value).strip() for value in values if str(value).strip()]


def _request_timeout() -> int:
    return int(getattr(settings, "SYSTEM_HEALTH_REQUEST_TIMEOUT_SECONDS", 6) or 6)


def _cache_ttl() -> int:
    return int(getattr(settings, "SYSTEM_HEALTH_CACHE_SECONDS", 60) or 60)


def _as_int(value: Any, default: int | None = None) -> int | None:
    try:
        if value is None or value == "":
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _as_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _first_ratio(value: Any) -> float | None:
    if value is None:
        return None
    first = str(value).split("-")[0]
    return _as_float(first)


def _round(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def _max_timestamp(current: int | None, value: Any) -> int | None:
    candidate = _as_int(value)
    if not candidate:
        return current
    if current is None:
        return candidate
    return max(current, candidate)


def _min_timestamp(current: int | None, value: Any) -> int | None:
    candidate = _as_int(value)
    if not candidate:
        return current
    if current is None:
        return candidate
    return min(current, candidate)
