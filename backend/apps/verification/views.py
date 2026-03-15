from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.permissions import IsAdminUser
from .models import DriverDocument
from .serializers import DriverDocumentSerializer, DocumentReviewSerializer


class DriverDocumentUploadView(generics.ListCreateAPIView):
    serializer_class = DriverDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DriverDocument.objects.filter(driver=self.request.user)


class AdminDocumentReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def patch(self, request, pk):
        try:
            doc = DriverDocument.objects.get(pk=pk)
        except DriverDocument.DoesNotExist:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'Document not found.'}},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = DocumentReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        doc.status = serializer.validated_data['status']
        doc.rejection_reason = serializer.validated_data.get('rejection_reason', '')
        doc.reviewed_by = request.user
        doc.reviewed_at = timezone.now()
        doc.save()
        return Response(DriverDocumentSerializer(doc).data)


class AdminDocumentListView(generics.ListAPIView):
    serializer_class = DriverDocumentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        driver_id = self.kwargs.get('driver_id')
        return DriverDocument.objects.filter(driver_id=driver_id).order_by('-uploaded_at')