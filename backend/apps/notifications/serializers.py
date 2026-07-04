from rest_framework import serializers

from apps.accounts.models import Campus
from .models import InAppAnnouncement, Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'notification_type', 'title', 'body', 'data', 'is_read', 'created_at']
        read_only_fields = fields


class InAppAnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InAppAnnouncement
        fields = [
            'campaign_id',
            'title',
            'body',
            'image_url',
            'icon_name',
            'cta_label',
        ]
        read_only_fields = fields


class AnnouncementCampusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campus
        fields = ['id', 'name', 'code']
        read_only_fields = fields


class AdminInAppAnnouncementSerializer(serializers.ModelSerializer):
    campus = AnnouncementCampusSerializer(read_only=True)
    campus_id = serializers.PrimaryKeyRelatedField(
        source='campus',
        queryset=Campus.objects.filter(is_active=True),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = InAppAnnouncement
        fields = [
            'id',
            'campaign_id',
            'title',
            'body',
            'image_url',
            'icon_name',
            'cta_label',
            'is_active',
            'audience',
            'send_push_notification',
            'starts_at',
            'ends_at',
            'priority',
            'campus',
            'campus_id',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'campus', 'created_at', 'updated_at']

    def validate_campaign_id(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Campaign ID is required.')
        return cleaned

    def validate(self, attrs):
        starts_at = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        ends_at = attrs.get('ends_at', getattr(self.instance, 'ends_at', None))
        if starts_at and ends_at and ends_at < starts_at:
            raise serializers.ValidationError({'ends_at': 'End date must be after the start date.'})
        return attrs
