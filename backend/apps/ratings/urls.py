from django.urls import path
from .views import RatingCreateView, MyRatingsReceivedView

urlpatterns = [
    path('', RatingCreateView.as_view(), name='rating-create'),
    path('received/', MyRatingsReceivedView.as_view(), name='ratings-received'),
]