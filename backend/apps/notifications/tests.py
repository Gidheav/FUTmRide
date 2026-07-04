from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import Campus, CampusAdminProfile, StudentProfile, User, UserRole
from .models import InAppAnnouncement


class ActiveInAppAnnouncementTests(APITestCase):
    endpoint = '/api/v1/notifications/announcements/active/'

    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            phone_number='+2348011111111',
            email='student.announcement@example.com',
            password='testpass123',
            first_name='Student',
            last_name='User',
            role=UserRole.STUDENT,
        )
        self.driver = User.objects.create_user(
            phone_number='+2348022222222',
            email='driver.announcement@example.com',
            password='testpass123',
            first_name='Driver',
            last_name='User',
            role=UserRole.DRIVER,
        )

    def test_student_receives_current_active_announcement(self):
        InAppAnnouncement.objects.create(
            campaign_id='semester_update_v1',
            title='New Semester Update',
            body='Welcome back to campus.',
            cta_label='Continue',
            is_active=True,
        )

        self.client.force_authenticate(self.student)
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['announcement']['campaign_id'], 'semester_update_v1')
        self.assertEqual(response.data['announcement']['title'], 'New Semester Update')
        self.assertEqual(response.data['announcement']['cta_label'], 'Continue')

    def test_driver_cannot_fetch_student_in_app_announcement(self):
        InAppAnnouncement.objects.create(
            campaign_id='students_only_v1',
            title='Students Only',
            body='This should not reach drivers.',
            is_active=True,
        )

        self.client.force_authenticate(self.driver)
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inactive_and_expired_announcements_are_ignored(self):
        now = timezone.now()
        InAppAnnouncement.objects.create(
            campaign_id='inactive_v1',
            title='Inactive',
            body='Hidden.',
            is_active=False,
        )
        InAppAnnouncement.objects.create(
            campaign_id='expired_v1',
            title='Expired',
            body='Hidden.',
            is_active=True,
            ends_at=now - timezone.timedelta(minutes=1),
        )

        self.client.force_authenticate(self.student)
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['announcement'])

    def test_highest_priority_current_announcement_is_returned(self):
        InAppAnnouncement.objects.create(
            campaign_id='lower_priority_v1',
            title='Lower',
            body='Lower priority.',
            is_active=True,
            priority=1,
        )
        InAppAnnouncement.objects.create(
            campaign_id='higher_priority_v1',
            title='Higher',
            body='Higher priority.',
            is_active=True,
            priority=9,
        )

        self.client.force_authenticate(self.student)
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['announcement']['campaign_id'], 'higher_priority_v1')

    def test_student_receives_own_campus_announcement_not_other_campus(self):
        campus = Campus.objects.create(name='Main Campus', code='MAIN')
        other_campus = Campus.objects.create(name='Other Campus', code='OTHER')
        StudentProfile.objects.create(user=self.student, campus=campus)
        InAppAnnouncement.objects.create(
            campaign_id='other_campus_v1',
            title='Other Campus',
            body='Hidden from this student.',
            campus=other_campus,
            is_active=True,
            priority=20,
        )
        InAppAnnouncement.objects.create(
            campaign_id='main_campus_v1',
            title='Main Campus',
            body='Visible to this student.',
            campus=campus,
            is_active=True,
            priority=10,
        )

        self.client.force_authenticate(self.student)
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['announcement']['campaign_id'], 'main_campus_v1')


class AdminInAppAnnouncementTests(APITestCase):
    endpoint = '/api/v1/notifications/announcements/admin/'

    def setUp(self):
        self.client = APIClient()
        self.campus = Campus.objects.create(name='Main Campus', code='MAIN')
        self.other_campus = Campus.objects.create(name='Other Campus', code='OTHER')
        self.campus_admin = User.objects.create_user(
            phone_number='+2348033333333',
            email='campus.admin.announcement@example.com',
            password='testpass123',
            first_name='Campus',
            last_name='Admin',
            role=UserRole.CAMPUS_ADMIN,
        )
        CampusAdminProfile.objects.create(user=self.campus_admin, campus=self.campus)
        self.driver = User.objects.create_user(
            phone_number='+2348044444444',
            email='driver.admin.announcement@example.com',
            password='testpass123',
            first_name='Driver',
            last_name='User',
            role=UserRole.DRIVER,
        )

    def test_campus_admin_can_create_campus_scoped_announcement(self):
        self.client.force_authenticate(self.campus_admin)
        response = self.client.post(self.endpoint, {
            'campaign_id': 'campus_semester_v1',
            'title': 'Semester Update',
            'body': 'Welcome back.',
            'cta_label': 'Continue',
            'is_active': True,
            'priority': 5,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        announcement = InAppAnnouncement.objects.get(campaign_id='campus_semester_v1')
        self.assertEqual(announcement.campus_id, self.campus.id)
        self.assertEqual(response.data['campus']['id'], str(self.campus.id))

    def test_campus_admin_lists_only_own_campus_announcements(self):
        InAppAnnouncement.objects.create(
            campaign_id='own_campus_v1',
            title='Own',
            body='Shown in admin list.',
            campus=self.campus,
            is_active=True,
        )
        InAppAnnouncement.objects.create(
            campaign_id='other_campus_v1',
            title='Other',
            body='Hidden from admin list.',
            campus=self.other_campus,
            is_active=True,
        )

        self.client.force_authenticate(self.campus_admin)
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        campaigns = [item['campaign_id'] for item in response.data['results']]
        self.assertEqual(campaigns, ['own_campus_v1'])

    def test_driver_cannot_manage_in_app_announcements(self):
        self.client.force_authenticate(self.driver)
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
