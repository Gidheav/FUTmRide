from django.urls import path
from .views import (
    RegisterView, LoginView, LogoutView,
    OTPRequestView, OTPVerifyView, ChangePasswordView,
    PasswordResetRequestView, PasswordResetConfirmView,
    SessionTokenRefreshView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('token/refresh/', SessionTokenRefreshView.as_view(), name='auth-token-refresh'),
    path('otp/request/', OTPRequestView.as_view(), name='auth-otp-request'),
    path('otp/verify/', OTPVerifyView.as_view(), name='auth-otp-verify'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='auth-password-reset-request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
]