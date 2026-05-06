import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(
            detail=exc.message_dict if hasattr(exc, 'message_dict') else exc.messages
        )

    response = exception_handler(exc, context)

    if response is not None:
        error_code = _resolve_error_code(exc)
        payload = {
            'error': {
                'code': error_code,
                'message': _resolve_message(response.data),
            }
        }
        if isinstance(exc, ValidationError):
            payload['error']['details'] = response.data

        logger.warning(
            'api_exception code=%s status=%s',
            error_code,
            response.status_code,
        )
        response.data = payload
        return response

    logger.error('unhandled_exception', exc_info=exc)
    return Response(
        {
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': 'An unexpected error occurred. Our team has been notified.',
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _resolve_error_code(exc):
    mapping = {
        'AuthenticationFailed': 'AUTHENTICATION_FAILED',
        'NotAuthenticated': 'NOT_AUTHENTICATED',
        'PermissionDenied': 'PERMISSION_DENIED',
        'NotFound': 'NOT_FOUND',
        'MethodNotAllowed': 'METHOD_NOT_ALLOWED',
        'Throttled': 'RATE_LIMIT_EXCEEDED',
        'ValidationError': 'VALIDATION_ERROR',
    }
    return mapping.get(type(exc).__name__, 'API_ERROR')


def _resolve_message(data):
    if isinstance(data, dict) and 'detail' in data:
        return str(data['detail'])
    if isinstance(data, dict):
        for value in data.values():
            if isinstance(value, list) and value:
                return str(value[0])
            if isinstance(value, str):
                return value
    if isinstance(data, list):
        return str(data[0]) if data else 'An error occurred.'
    return 'An error occurred.'
