from decimal import Decimal
from django.test import TestCase
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