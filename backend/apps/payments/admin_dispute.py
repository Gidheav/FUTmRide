"""Admin dispute resolution and ride refund endpoints for campus finance."""
from __future__ import annotations

import logging
from decimal import Decimal

from django.db import transaction
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.audit import log_audit
from apps.accounts.permissions import IsAdminOrCampusAdmin
from apps.payments.models import WalletTransaction
from apps.payments.services import WalletService
from apps.rides.models import Ride, RideStatus

from .admin_finance import _resolve_campus

logger = logging.getLogger('apps.payments')


def _assert_ride_campus_access(ride: Ride, user) -> None:
    campus = _resolve_campus(user)
    if campus is None:
        return
    try:
        if ride.student.student_profile.campus_id != campus.id:
            raise PermissionDenied('This ride is outside your campus scope.')
    except Exception as exc:
        raise PermissionDenied('Unable to verify campus scope for this ride.') from exc


class AdminRideRefundView(APIView):
    """Issue a wallet refund for a disputed ride (idempotent)."""

    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request, ride_id):
        try:
            ride = Ride.objects.select_related('student__student_profile').get(pk=ride_id)
        except Ride.DoesNotExist:
            raise NotFound('Ride not found.')

        _assert_ride_campus_access(ride, request.user)

        if ride.status != RideStatus.DISPUTED:
            raise ValidationError({'detail': 'Refunds can only be issued for disputed rides.'})

        if ride.payment_method != 'wallet' or not ride.is_paid:
            raise ValidationError({'detail': 'This ride has no refundable wallet payment.'})

        refund_amount = Decimal(str(ride.total_fare or 0))
        if refund_amount <= 0:
            raise ValidationError({'detail': 'Refund amount must be greater than zero.'})

        existing = WalletTransaction.objects.filter(
            ride=ride,
            source=WalletTransaction.Source.RIDE_REFUND,
            transaction_type=WalletTransaction.TransactionType.CREDIT,
        ).first()
        if existing:
            return Response({
                'status': 'already_refunded',
                'reference': existing.reference,
                'amount': str(existing.amount),
                'message': 'Refund was already issued for this ride.',
            })

        with transaction.atomic():
            wallet_tx = WalletService.credit(
                user=ride.student,
                amount=refund_amount,
                source=WalletTransaction.Source.RIDE_REFUND,
                narration=f'Admin dispute refund — {ride.reference}',
                ride=ride,
                metadata={
                    'resolved_by_admin': str(request.user.id),
                    'ride_reference': ride.reference,
                },
            )
            ride.is_paid = False
            ride.save(update_fields=['is_paid', 'updated_at'])

        log_audit(
            request,
            action='wallet_credit',
            target_type='ride',
            target_id=str(ride.id),
            metadata={
                'operation': 'admin_dispute_refund',
                'ride_reference': ride.reference,
                'amount': str(refund_amount),
                'wallet_tx_reference': wallet_tx.reference,
            },
        )
        logger.info(
            'admin_ride_refund ride=%s admin=%s amount=%s',
            ride.reference, str(request.user.id), refund_amount,
        )
        return Response({
            'status': 'refunded',
            'reference': wallet_tx.reference,
            'amount': str(refund_amount),
            'message': 'Refund credited to student wallet.',
        }, status=status.HTTP_201_CREATED)


class AdminResolveDisputeView(APIView):
    """Mark a disputed ride as resolved (completed)."""

    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request, ride_id):
        try:
            ride = Ride.objects.select_related('student__student_profile').get(pk=ride_id)
        except Ride.DoesNotExist:
            raise NotFound('Ride not found.')

        _assert_ride_campus_access(ride, request.user)

        if ride.status != RideStatus.DISPUTED:
            raise ValidationError({'detail': 'Only disputed rides can be resolved.'})

        resolution_note = (request.data.get('note') or '').strip()[:500]

        ride.status = RideStatus.COMPLETED
        ride.save(update_fields=['status', 'updated_at'])

        log_audit(
            request,
            action='other',
            target_type='ride',
            target_id=str(ride.id),
            metadata={
                'operation': 'admin_resolve_dispute',
                'ride_reference': ride.reference,
                'note': resolution_note,
            },
        )
        logger.info(
            'admin_dispute_resolved ride=%s admin=%s',
            ride.reference, str(request.user.id),
        )
        return Response({
            'status': 'resolved',
            'ride_reference': ride.reference,
            'message': 'Dispute marked as resolved.',
        })
