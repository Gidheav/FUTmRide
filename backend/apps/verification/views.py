from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsAdminUser, IsCampusAdminUser, IsDriverUser

from .models import AccountVerification, DriverDocument
from .serializers import (
    AccountVerificationSubmitSerializer,
    AccountVerificationStatusSerializer,
    AdminAccountVerificationListSerializer,
    AdminAccountVerificationDetailSerializer,
    AdminAccountVerificationReviewSerializer,
    AdminDriverDocumentSerializer,
    DriverDocumentSerializer,
    DriverDocumentStatusSerializer,
    DocumentReviewSerializer,
    PendingSubmissionSerializer,
    AdminVehicleVerificationDetailSerializer,
    AdminDriverSummarySerializer,
)


# ─────────────────────────────────────────────────────────────────────────────
#  DRIVER-FACING: Account Verification
# ─────────────────────────────────────────────────────────────────────────────

class AccountVerificationSubmitView(APIView):
    """
    POST: Driver submits their account verification details + NIN scan.
    GET:  Driver reads their current account verification status.
    """
    permission_classes = [permissions.IsAuthenticated, IsDriverUser]

    def get(self, request):
        try:
            av = AccountVerification.objects.get(driver=request.user)
            return Response(AccountVerificationStatusSerializer(av).data)
        except AccountVerification.DoesNotExist:
            return Response({'status': None, 'message': 'No account verification submitted yet.'})

    def post(self, request):
        # If already approved or under-review, reject re-submission
        existing = AccountVerification.objects.filter(
            driver=request.user,
            status__in=[
                AccountVerification.Status.PENDING,
                AccountVerification.Status.UNDER_REVIEW,
                AccountVerification.Status.APPROVED,
            ]
        ).first()

        if existing:
            return Response(
                {
                    'error': {
                        'code': 'ALREADY_SUBMITTED',
                        'message': 'Account verification already submitted.',
                        'status': existing.status,
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = AccountVerificationSubmitSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        av = serializer.save()
        return Response(
            AccountVerificationStatusSerializer(av).data,
            status=status.HTTP_201_CREATED,
        )


class AccountVerificationResubmitView(APIView):
    """
    PATCH: Driver resubmits after rejection (creates a fresh record replacing the rejected one).
    """
    permission_classes = [permissions.IsAuthenticated, IsDriverUser]

    def patch(self, request):
        try:
            av = AccountVerification.objects.get(
                driver=request.user, status=AccountVerification.Status.REJECTED
            )
        except AccountVerification.DoesNotExist:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'No rejected verification to resubmit.'}},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AccountVerificationSubmitSerializer(
            av, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        av.status = AccountVerification.Status.PENDING
        av.rejection_reason = ''
        av.reviewed_by = None
        av.reviewed_at = None
        serializer.save(
            status=AccountVerification.Status.PENDING,
            rejection_reason='',
            reviewed_by=None,
            reviewed_at=None,
        )
        return Response(AccountVerificationStatusSerializer(av).data)


# ─────────────────────────────────────────────────────────────────────────────
#  DRIVER-FACING: Vehicle Documents (gated behind account verification)
# ─────────────────────────────────────────────────────────────────────────────

class DriverDocumentUploadView(generics.ListCreateAPIView):
    """
    GET:  List all documents uploaded by the driver.
    POST: Upload a new vehicle document (requires account_verification.status == 'approved').
    """
    permission_classes = [permissions.IsAuthenticated, IsDriverUser]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return DriverDocumentStatusSerializer
        return DriverDocumentSerializer

    def get_queryset(self):
        return DriverDocument.objects.filter(driver=self.request.user)

    def create(self, request, *args, **kwargs):
        # Gate: account must be verified first
        try:
            av = AccountVerification.objects.get(driver=request.user)
            if av.status != AccountVerification.Status.APPROVED:
                return Response(
                    {
                        'error': {
                            'code': 'ACCOUNT_NOT_VERIFIED',
                            'message': (
                                'Your account identity must be approved before '
                                'you can submit vehicle documents.'
                            ),
                            'account_verification_status': av.status,
                        }
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        except AccountVerification.DoesNotExist:
            return Response(
                {
                    'error': {
                        'code': 'ACCOUNT_NOT_VERIFIED',
                        'message': 'You must complete account verification before uploading vehicle documents.',
                        'account_verification_status': None,
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().create(request, *args, **kwargs)


class DriverVerificationProgressView(APIView):
    """
    Returns the full verification progress for the authenticated driver:
    account stage + all vehicle doc statuses.
    """
    permission_classes = [permissions.IsAuthenticated, IsDriverUser]

    REQUIRED_VEHICLE_DOCS = [
        DriverDocument.DocumentType.DRIVERS_LICENSE,
        DriverDocument.DocumentType.VEHICLE_REGISTRATION,
        DriverDocument.DocumentType.VEHICLE_INSURANCE,
    ]

    def get(self, request):
        # Account verification stage
        try:
            av = AccountVerification.objects.get(driver=request.user)
            account_stage = {
                'status': av.status,
                'rejection_reason': av.rejection_reason,
                'submitted_at': av.submitted_at,
                'reviewed_at': av.reviewed_at,
            }
        except AccountVerification.DoesNotExist:
            account_stage = {'status': None}

        # Vehicle document stages
        docs = DriverDocument.objects.filter(driver=request.user)
        doc_map = {d.document_type: d for d in docs}

        vehicle_docs = []
        for doc_type in self.REQUIRED_VEHICLE_DOCS:
            doc = doc_map.get(doc_type)
            vehicle_docs.append({
                'document_type': doc_type,
                'document_type_display': DriverDocument.DocumentType(doc_type).label,
                'status': doc.status if doc else None,
                'rejection_reason': doc.rejection_reason if doc else None,
                'uploaded_at': doc.uploaded_at if doc else None,
            })

        return Response({
            'account_verification': account_stage,
            'vehicle_documents': vehicle_docs,
        })


# ─────────────────────────────────────────────────────────────────────────────
#  ADMIN-FACING: Account Verification Review
# ─────────────────────────────────────────────────────────────────────────────

class IsAdminOrCampusAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in ('admin', 'campus_admin')
        )


class AdminAccountVerificationListView(generics.ListAPIView):
    """List all account verifications with optional status filter."""
    serializer_class = AdminAccountVerificationListSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get_queryset(self):
        qs = AccountVerification.objects.select_related('driver').order_by('-submitted_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminAccountVerificationDetailView(generics.RetrieveAPIView):
    """Full detail for one account verification application."""
    serializer_class = AdminAccountVerificationDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
    queryset = AccountVerification.objects.select_related('driver', 'reviewed_by')


class AdminAccountVerificationReviewView(APIView):
    """Approve or reject an account verification."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def patch(self, request, pk):
        try:
            av = AccountVerification.objects.get(pk=pk)
        except AccountVerification.DoesNotExist:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'Account verification not found.'}},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AdminAccountVerificationReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        av.status = serializer.validated_data['status']
        av.rejection_reason = serializer.validated_data.get('rejection_reason', '')
        av.admin_notes = serializer.validated_data.get('admin_notes', '')
        av.reviewed_by = request.user
        av.reviewed_at = timezone.now()
        av.save()

        # If approved, mark user's account as verified
        if av.status == AccountVerification.Status.APPROVED:
            av.driver.is_verified = True
            av.driver.save(update_fields=['is_verified'])

        return Response(AdminAccountVerificationDetailSerializer(av, context={'request': request}).data)


# ─────────────────────────────────────────────────────────────────────────────
#  ADMIN-FACING: Vehicle Verification Review
# ─────────────────────────────────────────────────────────────────────────────

class AdminDocumentReviewView(APIView):
    """Approve or reject a specific vehicle document."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def patch(self, request, pk):
        try:
            doc = DriverDocument.objects.select_related('driver').get(pk=pk)
        except DriverDocument.DoesNotExist:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'Document not found.'}},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = DocumentReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        doc.status = serializer.validated_data['status']
        doc.rejection_reason = serializer.validated_data.get('rejection_reason', '')
        doc.admin_notes = serializer.validated_data.get('admin_notes', '')
        doc.reviewed_by = request.user
        doc.reviewed_at = timezone.now()
        doc.save()

        # After each review, check if all required docs are approved → mark driver verified
        self._check_driver_full_verification(doc.driver)

        return Response(AdminDriverDocumentSerializer(doc, context={'request': request}).data)

    REQUIRED_DOCS = [
        DriverDocument.DocumentType.DRIVERS_LICENSE,
        DriverDocument.DocumentType.VEHICLE_REGISTRATION,
        DriverDocument.DocumentType.VEHICLE_INSURANCE,
    ]

    def _check_driver_full_verification(self, driver):
        approved_types = set(
            DriverDocument.objects.filter(
                driver=driver, status=DriverDocument.DocumentStatus.APPROVED
            ).values_list('document_type', flat=True)
        )
        if all(dt in approved_types for dt in self.REQUIRED_DOCS):
            try:
                dp = driver.driver_profile
                from apps.accounts.models import DriverProfile
                dp.verification_status = DriverProfile.VerificationStatus.APPROVED
                dp.verified_at = timezone.now()
                dp.verified_by_id = None  # already tracked in doc
                dp.save(update_fields=['verification_status', 'verified_at'])
            except Exception:
                pass


class AdminDriverDocumentListView(generics.ListAPIView):
    """List all vehicle documents for a specific driver."""
    serializer_class = AdminDriverDocumentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get_queryset(self):
        driver_id = self.kwargs.get('driver_id')
        return DriverDocument.objects.filter(driver_id=driver_id).order_by('-uploaded_at')


class AdminVehicleVerificationDetailView(APIView):
    """
    Full vehicle verification state for a driver:
    account status + all required documents.
    Used to populate the left sidebar on the Vehicle Verification page.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request, driver_id):
        try:
            driver = User.objects.get(pk=driver_id)
        except User.DoesNotExist:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'Driver not found.'}},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            av = AccountVerification.objects.get(driver=driver)
            account_status = av.status
        except AccountVerification.DoesNotExist:
            account_status = None

        docs = DriverDocument.objects.filter(driver=driver).order_by('document_type')

        return Response({
            'driver': AdminDriverSummarySerializer(driver, context={'request': request}).data,
            'account_verification_status': account_status,
            'documents': AdminDriverDocumentSerializer(docs, many=True, context={'request': request}).data,
        })


class AdminDriverUnifiedVerificationView(APIView):
    """
    Unified view of ALL verification data for a driver:
    Account verification (Personal info, NIN) + Vehicle documents.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request, driver_id):
        try:
            driver = User.objects.get(pk=driver_id)
        except User.DoesNotExist:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'Driver not found.'}},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Account Verification
        try:
            av = AccountVerification.objects.get(driver=driver)
            account_data = AdminAccountVerificationDetailSerializer(av, context={'request': request}).data
        except AccountVerification.DoesNotExist:
            account_data = None

        # Vehicle Documents
        docs = DriverDocument.objects.filter(driver=driver).order_by('document_type')
        vehicle_docs = AdminDriverDocumentSerializer(docs, many=True, context={'request': request}).data

        return Response({
            'driver': AdminDriverSummarySerializer(driver, context={'request': request}).data,
            'account_verification': account_data,
            'vehicle_documents': vehicle_docs,
        })


class AdminRevokeVerificationView(APIView):
    """Revokes a driver's verification status."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request, driver_id):
        from apps.accounts.models import User, DriverProfile
        try:
            driver = User.objects.get(pk=driver_id)
            dp = driver.driver_profile
        except (User.DoesNotExist, Exception):
            return Response({'error': 'Driver profile not found'}, status=404)

        reason = request.data.get('reason', 'Verification revoked by admin.')
        
        # Reset Driver Profile
        dp.verification_status = DriverProfile.VerificationStatus.REJECTED
        dp.save(update_fields=['verification_status'])
        
        # Optional: Log the revocation in account verification
        try:
            av = AccountVerification.objects.get(driver=driver)
            av.status = AccountVerification.Status.REJECTED
            av.admin_notes = f"[REVOKED] {reason}\n{av.admin_notes}"
            av.save()
        except AccountVerification.DoesNotExist:
            pass

        return Response({'message': 'Verification revoked successfully.'})


# ─────────────────────────────────────────────────────────────────────────────
#  ADMIN-FACING: Unified Pending Submissions (Right Sidebar)
# ─────────────────────────────────────────────────────────────────────────────

class AdminPendingSubmissionsView(APIView):
    """
    Returns a unified list of all pending account + vehicle submissions.
    Used to populate the right sidebar on verification review pages.
    Query params:
      - type: 'account' | 'vehicle' | 'all' (default: 'all')
      - status: 'pending' | 'under_review' (default: both)
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        submission_type = request.query_params.get('type', 'all')
        status_filter = request.query_params.get('status', None)

        results = []

        # Account verifications
        if submission_type in ('all', 'account'):
            av_qs = AccountVerification.objects.select_related('driver').order_by('-submitted_at')
            if status_filter:
                av_qs = av_qs.filter(status=status_filter)
            else:
                av_qs = av_qs.filter(status__in=['pending', 'under_review'])

            for av in av_qs:
                profile_photo = None
                if av.driver.profile_photo:
                    try:
                        profile_photo = request.build_absolute_uri(av.driver.profile_photo.url)
                    except Exception:
                        pass

                results.append({
                    'id': str(av.id),
                    'type': 'account',
                    'driver_id': str(av.driver.id),
                    'driver_name': av.driver.full_name,
                    'driver_phone': str(av.driver.phone_number) if av.driver.phone_number else '',
                    'profile_photo': profile_photo,
                    'document_type': None,
                    'status': av.status,
                    'submitted_at': av.submitted_at.isoformat(),
                })

        # Vehicle documents
        if submission_type in ('all', 'vehicle'):
            doc_qs = DriverDocument.objects.select_related('driver').order_by('-uploaded_at')
            if status_filter:
                doc_qs = doc_qs.filter(status=status_filter)
            else:
                doc_qs = doc_qs.filter(status='pending')

            seen_drivers = set()
            for doc in doc_qs:
                driver_id = str(doc.driver.id)
                if driver_id in seen_drivers:
                    continue
                seen_drivers.add(driver_id)

                profile_photo = None
                if doc.driver.profile_photo:
                    try:
                        profile_photo = request.build_absolute_uri(doc.driver.profile_photo.url)
                    except Exception:
                        pass

                results.append({
                    'id': str(doc.id),
                    'type': 'vehicle',
                    'driver_id': driver_id,
                    'driver_name': doc.driver.full_name,
                    'driver_phone': str(doc.driver.phone_number) if doc.driver.phone_number else '',
                    'profile_photo': profile_photo,
                    'document_type': doc.document_type,
                    'status': doc.status,
                    'submitted_at': doc.uploaded_at.isoformat(),
                })

        # Sort combined list by submitted_at descending
        results.sort(key=lambda x: x['submitted_at'], reverse=True)

        return Response({'results': results, 'count': len(results)})