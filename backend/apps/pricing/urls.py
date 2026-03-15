from django.urls import path
from .views import FareConfigListView, FareConfigDetailView, FareEstimateView

urlpatterns = [
    path('config/', FareConfigListView.as_view(), name='fare-config-list'),
    path('config/<uuid:pk>/', FareConfigDetailView.as_view(), name='fare-config-detail'),
    path('estimate/', FareEstimateView.as_view(), name='fare-estimate'),
]