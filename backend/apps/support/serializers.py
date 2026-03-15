import uuid
from rest_framework import serializers
from .models import SupportTicket


class SupportTicketCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = ['ride', 'category', 'subject', 'description', 'priority']

    def create(self, validated_data):
        validated_data['submitted_by'] = self.context['request'].user
        validated_data['reference'] = 'TK' + uuid.uuid4().hex[:8].upper()
        return SupportTicket.objects.create(**validated_data)


class SupportTicketSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.CharField(source='submitted_by.full_name', read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'reference', 'submitted_by_name', 'category',
            'subject', 'description', 'status', 'priority',
            'resolution_notes', 'created_at', 'resolved_at',
        ]
        read_only_fields = ['id', 'reference', 'submitted_by_name', 'status', 'resolution_notes', 'created_at', 'resolved_at']


class AdminTicketUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = ['status', 'priority', 'resolution_notes', 'assigned_to']