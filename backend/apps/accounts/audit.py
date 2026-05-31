import logging

from core.security_utils import get_client_ip

from .models import AuditLog

logger = logging.getLogger('apps.security.audit')


def log_audit(
    request,
    action: str,
    *,
    target_type: str = '',
    target_id: str = '',
    metadata: dict | None = None,
    actor=None,
):
    if actor is None and request is not None:
        actor = getattr(request, 'user', None)
        if actor is not None and not getattr(actor, 'is_authenticated', False):
            actor = None
    try:
        AuditLog.objects.create(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id else '',
            ip_address=get_client_ip(request) if request else None,
            metadata=metadata or {},
        )
    except Exception:
        logger.exception('audit_log_write_failed action=%s', action)
