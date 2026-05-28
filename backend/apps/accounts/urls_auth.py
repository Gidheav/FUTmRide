from django.urls import path
from .views import (
    RegisterView, LoginView, LogoutView,
    StudentSignupRequestEmailOTPView, StudentSignupVerifyEmailOTPView,
    OTPRequestView, OTPVerifyView, ChangePasswordView,
    PasswordResetRequestView, PasswordResetConfirmView,
    SessionTokenRefreshView,
    ChangeEmailView, RequestPasswordChangeOTPView, ConfirmPasswordChangeView,
    UserSettingsView,
    PinSetView, PinVerifyView,
    TwoFactorStartView, TwoFactorConfirmView, TwoFactorDisableView,
    TwoFactorChallengeRequestView, TwoFactorChallengeVerifyView,
)

urlpatterns = [
    path('register/request-email-otp/', StudentSignupRequestEmailOTPView.as_view(), name='auth-register-request-email-otp'),
    path('register/verify-email-otp/', StudentSignupVerifyEmailOTPView.as_view(), name='auth-register-verify-email-otp'),
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('token/refresh/', SessionTokenRefreshView.as_view(), name='auth-token-refresh'),
    path('otp/request/', OTPRequestView.as_view(), name='auth-otp-request'),
    path('otp/verify/', OTPVerifyView.as_view(), name='auth-otp-verify'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='auth-password-reset-request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
    # Account settings
    path('settings/preferences/', UserSettingsView.as_view(), name='auth-settings-preferences'),
    path('settings/pin/set/', PinSetView.as_view(), name='auth-settings-pin-set'),
    path('settings/pin/verify/', PinVerifyView.as_view(), name='auth-settings-pin-verify'),
    path('settings/2fa/start/', TwoFactorStartView.as_view(), name='auth-settings-2fa-start'),
    path('settings/2fa/confirm/', TwoFactorConfirmView.as_view(), name='auth-settings-2fa-confirm'),
    path('settings/2fa/disable/', TwoFactorDisableView.as_view(), name='auth-settings-2fa-disable'),
    path('2fa/request/', TwoFactorChallengeRequestView.as_view(), name='auth-2fa-request'),
    path('2fa/verify/', TwoFactorChallengeVerifyView.as_view(), name='auth-2fa-verify'),
    path('settings/change-email/', ChangeEmailView.as_view(), name='auth-change-email'),
    path('settings/password-change/request-otp/', RequestPasswordChangeOTPView.as_view(), name='auth-password-change-otp'),
    path('settings/password-change/confirm/', ConfirmPasswordChangeView.as_view(), name='auth-password-change-confirm'),
]
