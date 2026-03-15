import uuid
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from apps.accounts.models import User
from apps.rides.models import Ride


class Rating(models.Model):
    class RatingType(models.TextChoices):
        STUDENT_TO_DRIVER = 'student_to_driver', 'Student to Driver'
        DRIVER_TO_STUDENT = 'driver_to_student', 'Driver to Student'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='ratings')
    rater = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ratings_given')
    ratee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ratings_received')
    rating_type = models.CharField(max_length=20, choices=RatingType.choices)
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True, max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ratings'
        unique_together = [('ride', 'rater', 'rating_type')]
        indexes = [
            models.Index(fields=['ratee', 'rating_type']),
            models.Index(fields=['ride']),
        ]

    def __str__(self):
        return f'Rating({self.rating_type} score={self.score} ride={self.ride.reference})'