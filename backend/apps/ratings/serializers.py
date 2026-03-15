from rest_framework import serializers
from .models import Rating


class RatingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rating
        fields = ['ride', 'score', 'comment']

    def validate(self, attrs):
        request = self.context['request']
        user = request.user
        ride = attrs['ride']

        if user == ride.student:
            if not ride.driver:
                raise serializers.ValidationError('Cannot rate a ride with no driver.')
            attrs['rater'] = user
            attrs['ratee'] = ride.driver
            attrs['rating_type'] = Rating.RatingType.STUDENT_TO_DRIVER
        elif user == ride.driver:
            attrs['rater'] = user
            attrs['ratee'] = ride.student
            attrs['rating_type'] = Rating.RatingType.DRIVER_TO_STUDENT
        else:
            raise serializers.ValidationError('You are not a participant of this ride.')

        if ride.status != 'completed':
            raise serializers.ValidationError('You can only rate completed rides.')

        already = Rating.objects.filter(
            ride=ride, rater=user, rating_type=attrs['rating_type']
        ).exists()
        if already:
            raise serializers.ValidationError('You have already rated this ride.')

        return attrs

    def create(self, validated_data):
        rating = Rating.objects.create(**validated_data)
        self._update_average(validated_data['ratee'], validated_data['rating_type'])
        return rating

    def _update_average(self, user, rating_type):
        from django.db.models import Avg
        avg = Rating.objects.filter(ratee=user, rating_type=rating_type).aggregate(Avg('score'))['score__avg']
        if avg is None:
            return
        if rating_type == Rating.RatingType.STUDENT_TO_DRIVER:
            try:
                user.driver_profile.average_rating = round(avg, 2)
                user.driver_profile.save(update_fields=['average_rating'])
            except Exception:
                pass
        else:
            try:
                user.student_profile.average_rating_given = round(avg, 2)
                user.student_profile.save(update_fields=['average_rating_given'])
            except Exception:
                pass


class RatingSerializer(serializers.ModelSerializer):
    rater_name = serializers.CharField(source='rater.full_name', read_only=True)

    class Meta:
        model = Rating
        fields = ['id', 'ride', 'rater_name', 'score', 'comment', 'rating_type', 'created_at']
        read_only_fields = fields