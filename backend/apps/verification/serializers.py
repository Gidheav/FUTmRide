from rest_framework import serializers
from .models import DriverDocument


class DriverDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverDocument
        fields = ['id', 'document_type', 'file', 'status', 'rejection_reason', 'uploaded_at']
        read_only_fields = ['id', 'status', 'rejection_reason', 'uploaded_at']

    def create(self, validated_data):
        validated_data['driver'] = self.context['request'].user
        return super().create(validated_data)


class DocumentReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['approved', 'rejected'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)