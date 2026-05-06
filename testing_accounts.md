# LR Ride Testing Accounts

The following credentials will be used to test the different roles and access levels within the application. These accounts will be created during the implementation phase.

## 1. Student Account
- **Role:** Student
- **Portal:** `/login` & `/student/*`
- **Phone Number:** `+2348000000001`
- **Password:** `StudentPass123!`
- **Expected Setup:** Verified phone number, linked `StudentProfile` (Matric Number: `FUT/20/0001`).

## 2. Driver Account
- **Role:** Driver
- **Portal:** `/driver/login` & `/driver/*`
- **Phone Number:** `+2348000000002`
- **Password:** `DriverPass123!`
- **Expected Setup:** Verified phone number, linked `DriverProfile` with `APPROVED` verification status so they can go online to accept rides.
3. Campus Admin Account
- **Role:** Campus Admin 
- **Portal:** `/campus-admin/login` &    `/campus-admin/*`
- **Phone Number:** `+2348000000004`
- **Password:** `CampusAdminPass123!`
- **Expected Setup:** `is_staff=True`, `is_superuser=False`.

## 4. Admin Account
- **Role:** Admin (Superuser)
- **Portal:** `/admin/login` & `/admin/*`
- **Phone Number:** `+2348000000000`
- **Password:** `AdminPass123!`
- **Expected Setup:** `is_staff=True`, `is_superuser=True`. Has access to manage all other accounts, verify drivers, and view analytics.
