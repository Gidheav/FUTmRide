import json
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User, StudentProfile, UserRole
from .models import WalletTransaction
from .services import WalletService


def make_student(phone='+2348011111111'):
    user = User.objects.create_user(
        phone_number=phone,
        password='SecurePass123!',
        first_name='Aisha',
        last_name='Bello',
        role=UserRole.STUDENT,
        data_consent_given=True,
    )
    StudentProfile.objects.create(user=user)
    return user


class WalletServiceTestCase(TestCase):
    def setUp(self):
        self.user = make_student()

    def test_credit_increases_balance(self):
        WalletService.credit(
            user=self.user,
            amount=Decimal('5000.00'),
            source=WalletTransaction.Source.TOPUP_PAYSTACK,
            narration='Test top-up',
        )
        self.user.student_profile.refresh_from_db()
        self.assertEqual(self.user.student_profile.wallet_balance, Decimal('5000.00'))

    def test_debit_decreases_balance(self):
        WalletService.credit(self.user, Decimal('5000.00'), WalletTransaction.Source.TOPUP_PAYSTACK, 'Top-up')
        WalletService.debit(self.user, Decimal('1500.00'), WalletTransaction.Source.RIDE_PAYMENT, 'Ride payment')
        self.user.student_profile.refresh_from_db()
        self.assertEqual(self.user.student_profile.wallet_balance, Decimal('3500.00'))

    def test_debit_below_zero_raises(self):
        with self.assertRaises(ValueError):
            WalletService.debit(
                user=self.user,
                amount=Decimal('1000.00'),
                source=WalletTransaction.Source.RIDE_PAYMENT,
                narration='Should fail',
            )

    def test_transaction_record_created(self):
        WalletService.credit(self.user, Decimal('2000.00'), WalletTransaction.Source.TOPUP_PAYSTACK, 'Test')
        count = WalletTransaction.objects.filter(user=self.user).count()
        self.assertEqual(count, 1)

    def test_balance_before_and_after_recorded(self):
        WalletService.credit(self.user, Decimal('3000.00'), WalletTransaction.Source.TOPUP_PAYSTACK, 'First')
        WalletService.credit(self.user, Decimal('2000.00'), WalletTransaction.Source.TOPUP_PAYSTACK, 'Second')
        tx = WalletTransaction.objects.filter(user=self.user).order_by('created_at').last()
        self.assertEqual(tx.balance_before, Decimal('3000.00'))
        self.assertEqual(tx.balance_after, Decimal('5000.00'))

    def test_concurrent_debit_protected_by_select_for_update(self):
        WalletService.credit(self.user, Decimal('1000.00'), WalletTransaction.Source.TOPUP_PAYSTACK, 'Base')
        WalletService.debit(self.user, Decimal('1000.00'), WalletTransaction.Source.RIDE_PAYMENT, 'Full debit')
        self.user.student_profile.refresh_from_db()
        self.assertEqual(self.user.student_profile.wallet_balance, Decimal('0.00'))


class WalletTransferApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.sender = make_student(phone='+2348090000001')
        self.recipient = make_student(phone='+2348090000002')
        self.sender.student_profile.matric_number = 'm2301111'
        self.sender.student_profile.save(update_fields=['matric_number'])
        self.recipient.student_profile.matric_number = 'm2302222'
        self.recipient.student_profile.save(update_fields=['matric_number'])
        WalletService.credit(
            self.sender,
            Decimal('5000.00'),
            WalletTransaction.Source.TOPUP_PAYSTACK,
            'Seed sender wallet',
        )
        self.client.force_authenticate(user=self.sender)

    def test_lookup_recipient_from_qr_payload(self):
        payload = json.dumps({'recipient_id': str(self.recipient.id), 'type': 'wallet_transfer'})
        response = self.client.post(
            reverse('wallet-transfer-lookup'),
            {'recipient_code': payload},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['recipient']['user_id'], str(self.recipient.id))

    def test_transfer_moves_money_between_students(self):
        response = self.client.post(
            reverse('wallet-transfer'),
            {'recipient_code': str(self.recipient.id), 'amount': '1200.00'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.sender.student_profile.refresh_from_db()
        self.recipient.student_profile.refresh_from_db()
        self.assertEqual(self.sender.student_profile.wallet_balance, Decimal('3800.00'))
        self.assertEqual(self.recipient.student_profile.wallet_balance, Decimal('1200.00'))

        sender_tx = WalletTransaction.objects.filter(
            user=self.sender,
            source=WalletTransaction.Source.STUDENT_TRANSFER_SENT,
            transaction_type=WalletTransaction.TransactionType.DEBIT,
        ).first()
        recipient_tx = WalletTransaction.objects.filter(
            user=self.recipient,
            source=WalletTransaction.Source.STUDENT_TRANSFER_RECEIVED,
            transaction_type=WalletTransaction.TransactionType.CREDIT,
        ).first()
        self.assertIsNotNone(sender_tx)
        self.assertIsNotNone(recipient_tx)
        self.assertEqual(
            sender_tx.metadata.get('transfer_reference'),
            recipient_tx.metadata.get('transfer_reference'),
        )

    def test_transfer_rejects_self_transfer(self):
        response = self.client.post(
            reverse('wallet-transfer'),
            {'recipient_code': str(self.sender.id), 'amount': '200.00'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error']['code'], 'SELF_TRANSFER')

    def test_transfer_rejects_insufficient_balance(self):
        response = self.client.post(
            reverse('wallet-transfer'),
            {'recipient_code': str(self.recipient.id), 'amount': '8000.00'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error']['message'], 'Insufficient wallet balance.')
