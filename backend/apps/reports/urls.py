from django.urls import path

from apps.reports import views

urlpatterns = [
    path('catalog/', views.ReportCatalogView.as_view(), name='reports-catalog'),
    path('generate/', views.ReportGenerateView.as_view(), name='reports-generate'),
    path('runs/', views.ReportRunListView.as_view(), name='reports-runs'),
    path('runs/<uuid:run_id>/', views.ReportRunDetailView.as_view(), name='reports-run-detail'),
    path('runs/<uuid:run_id>/download/', views.ReportRunDownloadView.as_view(), name='reports-run-download'),
    path('schedules/', views.ScheduledReportListCreateView.as_view(), name='reports-schedules'),
    path('schedules/<uuid:schedule_id>/', views.ScheduledReportDetailView.as_view(), name='reports-schedule-detail'),
    path('consent/', views.StatementAccessListCreateView.as_view(), name='reports-consent'),
    path('consent/<uuid:request_id>/<str:action>/', views.StatementAccessActionView.as_view(), name='reports-consent-action'),
    path('consent/<uuid:request_id>/generate/', views.StatementAccessGenerateView.as_view(), name='reports-consent-generate'),
]
