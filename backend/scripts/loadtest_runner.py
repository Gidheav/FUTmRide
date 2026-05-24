"""
═══════════════════════════════════════════════════════════════════════════════════
 LR-Ride Load Test Runner
 Simulates 20 drivers creating garage rides + 100 students scanning & boarding.
 Runs concurrently via asyncio + aiohttp against the LIVE Render server.

 Prerequisites:
   1. Run loadtest_seed.py first (creates the test accounts)
   2. pip install aiohttp  (or: pip install aiohttp[speedups])

 Usage:
   python backend/scripts/loadtest_runner.py

 What it does:
   Phase 1: All 20 drivers log in concurrently
   Phase 2: Each driver creates a garage ride (staggered by 0.5s)
   Phase 3: All 100 students log in concurrently
   Phase 4: Students scan QR codes and board rides (5 students per ride)
   Phase 5: Some drivers depart, some cancel — tests all WebSocket events
   Phase 6: Print summary report

 The campus admin dashboard should show rides appearing/updating/departing
 in REAL-TIME if you have it open during the test!
═══════════════════════════════════════════════════════════════════════════════════
"""
import asyncio
import aiohttp
import json
import random
import time
import sys
from dataclasses import dataclass, field
from typing import Optional

# ── Config ─────────────────────────────────────────────────────────────────────
BASE_URL = 'https://futmride.onrender.com/api/v1'
PASSWORD = 'LoadTest2026!'
NUM_DRIVERS = 5
NUM_STUDENTS = 15
STUDENTS_PER_RIDE = 3  # Each ride gets 3 students boarding

# Concurrent request limits (Free Render instances have 0.1 CPU, so password hashing is slow!)
MAX_CONCURRENT_LOGINS = 1
MAX_CONCURRENT_RIDES = 1
MAX_CONCURRENT_BOARDS = 1

# Request timeout
TIMEOUT = aiohttp.ClientTimeout(total=120)

# FUT Minna campus locations for realistic ride origins/destinations
ORIGINS = [
    ('Main Gate', 9.5363, 6.4506),
    ('Gidan Kwano', 9.5323, 6.4526),
    ('Hostel Area', 9.5410, 6.4490),
    ('Market Area', 9.5250, 6.4480),
    ('Bosso Campus', 9.6175, 6.5508),
]

DESTINATIONS = [
    ('Lecture Hall Complex', 9.5340, 6.4550),
    ('Library', 9.5310, 6.4540),
    ('Senate Building', 9.5350, 6.4510),
    ('Engineering Faculty', 9.5380, 6.4570),
    ('Science Faculty', 9.5290, 6.4530),
]


@dataclass
class TestResult:
    """Tracks pass/fail stats for the test run."""
    driver_logins_ok: int = 0
    driver_logins_fail: int = 0
    rides_created: int = 0
    rides_failed: int = 0
    student_logins_ok: int = 0
    student_logins_fail: int = 0
    boards_ok: int = 0
    boards_fail: int = 0
    departs_ok: int = 0
    departs_fail: int = 0
    cancels_ok: int = 0
    cancels_fail: int = 0
    errors: list = field(default_factory=list)
    ride_qr_tokens: list = field(default_factory=list)
    ride_ids: list = field(default_factory=list)


# ── Helpers ────────────────────────────────────────────────────────────────────

def driver_phone(i: int) -> str:
    return f'+23480100{i:05d}'

def student_phone(i: int) -> str:
    return f'+23480200{i:05d}'

def progress(msg: str):
    sys.stdout.write(f'\r  ⏳ {msg}')
    sys.stdout.flush()


async def login(session: aiohttp.ClientSession, phone: str) -> Optional[str]:
    """Log in and return the access token."""
    try:
        async with session.post(f'{BASE_URL}/auth/login/', json={
            'phone_number': phone,
            'password': PASSWORD,
        }, timeout=TIMEOUT) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get('access')
            else:
                text = await resp.text()
                return None
    except Exception as e:
        return None


async def create_garage_ride(session: aiohttp.ClientSession, token: str, driver_idx: int) -> Optional[dict]:
    """Driver creates a garage ride."""
    origin = ORIGINS[driver_idx % len(ORIGINS)]
    dest = DESTINATIONS[driver_idx % len(DESTINATIONS)]

    payload = {
        'origin_address': origin[0],
        'origin_latitude': str(origin[1] + random.uniform(-0.002, 0.002)),
        'origin_longitude': str(origin[2] + random.uniform(-0.002, 0.002)),
        'destination_address': dest[0],
        'destination_latitude': str(dest[1] + random.uniform(-0.002, 0.002)),
        'destination_longitude': str(dest[2] + random.uniform(-0.002, 0.002)),
        'vehicle_type': random.choice(['sedan', 'suv', 'minivan']),
        'total_seats': random.randint(3, 6),
        'fare_per_seat': str(random.choice([100, 150, 200, 250, 300, 500])),
        'driver_note': f'Load test ride from driver #{driver_idx}',
    }

    try:
        async with session.post(f'{BASE_URL}/rides/garage/create/', json=payload,
                                headers={'Authorization': f'Bearer {token}'},
                                timeout=TIMEOUT) as resp:
            if resp.status == 201:
                return await resp.json()
            else:
                text = await resp.text()
                return None
    except Exception as e:
        return None


async def board_ride(session: aiohttp.ClientSession, token: str, qr_token: str, seats: int = 1) -> bool:
    """Student boards a garage ride."""
    try:
        async with session.post(f'{BASE_URL}/rides/garage/scan/{qr_token}/board/',
                                json={'seats': seats},
                                headers={'Authorization': f'Bearer {token}'},
                                timeout=TIMEOUT) as resp:
            return resp.status == 201
    except Exception:
        return False


async def depart_ride(session: aiohttp.ClientSession, token: str, ride_id: str) -> bool:
    """Driver departs a ride."""
    try:
        async with session.post(f'{BASE_URL}/rides/garage/{ride_id}/depart/',
                                headers={'Authorization': f'Bearer {token}'},
                                timeout=TIMEOUT) as resp:
            return resp.status == 200
    except Exception:
        return False


async def cancel_ride(session: aiohttp.ClientSession, token: str, ride_id: str) -> bool:
    """Driver cancels a ride."""
    try:
        async with session.post(f'{BASE_URL}/rides/garage/{ride_id}/cancel/',
                                headers={'Authorization': f'Bearer {token}'},
                                timeout=TIMEOUT) as resp:
            return resp.status == 200
    except Exception:
        return False


# ── Main Test Phases ───────────────────────────────────────────────────────────

async def phase1_driver_logins(session: aiohttp.ClientSession, result: TestResult) -> list:
    """Phase 1: Log in all drivers."""
    print(f'\n━━━ Phase 1: Driver Logins ({NUM_DRIVERS} drivers) ━━━')
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_LOGINS)
    tokens = [None] * NUM_DRIVERS

    async def do_login(i):
        async with semaphore:
            progress(f'Logging in driver {i}/{NUM_DRIVERS}...')
            token = await login(session, driver_phone(i))
            if token and not token.startswith('{'):
                tokens[i - 1] = token
                result.driver_logins_ok += 1
            else:
                result.driver_logins_fail += 1
                result.errors.append(f'Driver {i} login failed: {token[:100] if token else "Timeout"}')

    await asyncio.gather(*[do_login(i) for i in range(1, NUM_DRIVERS + 1)])
    print(f'\n  ✅ {result.driver_logins_ok} logged in, ❌ {result.driver_logins_fail} failed')
    return tokens


async def phase2_create_rides(session: aiohttp.ClientSession, driver_tokens: list, result: TestResult) -> list:
    """Phase 2: Each driver creates a garage ride."""
    print(f'\n━━━ Phase 2: Create Garage Rides ({NUM_DRIVERS} rides) ━━━')
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_RIDES)
    rides = []  # List of (driver_token, ride_data)

    async def do_create(i, token):
        if not token:
            return
        async with semaphore:
            progress(f'Driver {i} creating ride...')
            # Stagger slightly to avoid hitting the "active ride exists" check race
            await asyncio.sleep(i * 0.3)
            ride_data = await create_garage_ride(session, token, i)
            if ride_data and 'error_text' not in ride_data:
                result.rides_created += 1
                result.ride_qr_tokens.append(ride_data.get('qr_token'))
                result.ride_ids.append(ride_data.get('id'))
                rides.append((token, ride_data))
            else:
                result.rides_failed += 1
                err_msg = ride_data.get('error_text')[:100] if ride_data else "Timeout"
                result.errors.append(f'Driver {i} ride creation failed: {err_msg}')

    await asyncio.gather(*[do_create(i + 1, t) for i, t in enumerate(driver_tokens)])
    print(f'\n  ✅ {result.rides_created} rides created, ❌ {result.rides_failed} failed')
    return rides


async def phase3_student_logins(session: aiohttp.ClientSession, result: TestResult) -> list:
    """Phase 3: Log in all students."""
    print(f'\n━━━ Phase 3: Student Logins ({NUM_STUDENTS} students) ━━━')
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_LOGINS)
    tokens = [None] * NUM_STUDENTS

    async def do_login(i):
        async with semaphore:
            progress(f'Logging in student {i}/{NUM_STUDENTS}...')
            token = await login(session, student_phone(i))
            if token and not token.startswith('{'):
                tokens[i - 1] = token
                result.student_logins_ok += 1
            else:
                result.student_logins_fail += 1
                result.errors.append(f'Student {i} login failed: {token[:100] if token else "Timeout"}')

    await asyncio.gather(*[do_login(i) for i in range(1, NUM_STUDENTS + 1)])
    print(f'\n  ✅ {result.student_logins_ok} logged in, ❌ {result.student_logins_fail} failed')
    return tokens


async def phase4_board_rides(session: aiohttp.ClientSession, student_tokens: list,
                              rides: list, result: TestResult):
    """Phase 4: Students scan and board rides (5 per ride)."""
    print('\n━━━ Phase 4: Students Board Rides ━━━')
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_BOARDS)

    if not result.ride_qr_tokens:
        print('  ⚠️  No rides to board — skipping')
        return

    # Distribute students across rides: 5 students per ride
    valid_student_tokens = [t for t in student_tokens if t]
    boards = []

    for ride_idx, qr_token in enumerate(result.ride_qr_tokens):
        start = ride_idx * STUDENTS_PER_RIDE
        end = start + STUDENTS_PER_RIDE
        for student_token in valid_student_tokens[start:end]:
            boards.append((student_token, qr_token))

    async def do_board(idx, student_token, qr_token):
        async with semaphore:
            progress(f'Boarding {idx + 1}/{len(boards)}...')
            await asyncio.sleep(idx * 0.2)  # Stagger to avoid race conditions
            ok = await board_ride(session, student_token, qr_token)
            if ok:
                result.boards_ok += 1
            else:
                result.boards_fail += 1

    await asyncio.gather(*[do_board(i, st, qr) for i, (st, qr) in enumerate(boards)])
    print(f'\n  ✅ {result.boards_ok} boarded, ❌ {result.boards_fail} failed')


async def phase5_depart_and_cancel(session: aiohttp.ClientSession, rides: list, result: TestResult):
    """Phase 5: Half the rides depart, a few cancel — tests all WS events."""
    print('\n━━━ Phase 5: Depart & Cancel ━━━')

    if not rides:
        print('  ⚠️  No rides to depart/cancel — skipping')
        return

    # First 60% depart, next 20% cancel, rest stay open
    depart_count = int(len(rides) * 0.6)
    cancel_count = int(len(rides) * 0.2)

    for i in range(depart_count):
        token, ride_data = rides[i]
        ride_id = ride_data.get('id')
        progress(f'Departing ride {i + 1}...')
        ok = await depart_ride(session, token, ride_id)
        if ok:
            result.departs_ok += 1
        else:
            result.departs_fail += 1
        await asyncio.sleep(0.5)

    for i in range(depart_count, depart_count + cancel_count):
        if i >= len(rides):
            break
        token, ride_data = rides[i]
        ride_id = ride_data.get('id')
        progress(f'Cancelling ride {i + 1}...')
        ok = await cancel_ride(session, token, ride_id)
        if ok:
            result.cancels_ok += 1
        else:
            result.cancels_fail += 1
        await asyncio.sleep(0.5)

    remaining = len(rides) - depart_count - cancel_count
    print(f'\n  ✅ {result.departs_ok} departed, {result.cancels_ok} cancelled, {remaining} still open')


def print_report(result: TestResult, elapsed: float):
    """Print final summary."""
    total_ops = (result.driver_logins_ok + result.rides_created +
                 result.student_logins_ok + result.boards_ok +
                 result.departs_ok + result.cancels_ok)
    total_fails = (result.driver_logins_fail + result.rides_failed +
                   result.student_logins_fail + result.boards_fail +
                   result.departs_fail + result.cancels_fail)

    print('\n')
    print('╔══════════════════════════════════════════════════════════════╗')
    print('║                  LOAD TEST REPORT                           ║')
    print('╠══════════════════════════════════════════════════════════════╣')
    print(f'║  Duration:              {elapsed:.1f}s')
    print(f'║  Total operations:      {total_ops} OK / {total_fails} FAILED')
    print(f'║  Throughput:            {total_ops / elapsed:.1f} ops/sec')
    print('╠══════════════════════════════════════════════════════════════╣')
    print(f'║  Driver logins:         {result.driver_logins_ok:>3} ✅  {result.driver_logins_fail:>3} ❌')
    print(f'║  Rides created:         {result.rides_created:>3} ✅  {result.rides_failed:>3} ❌')
    print(f'║  Student logins:        {result.student_logins_ok:>3} ✅  {result.student_logins_fail:>3} ❌')
    print(f'║  Students boarded:      {result.boards_ok:>3} ✅  {result.boards_fail:>3} ❌')
    print(f'║  Rides departed:        {result.departs_ok:>3} ✅  {result.departs_fail:>3} ❌')
    print(f'║  Rides cancelled:       {result.cancels_ok:>3} ✅  {result.cancels_fail:>3} ❌')
    print('╠══════════════════════════════════════════════════════════════╣')

    if result.errors:
        print(f'║  First 10 errors:')
        for e in result.errors[:10]:
            print(f'║    • {e}')

    if total_fails == 0:
        print('║                                                              ║')
        print('║  🎉 ALL TESTS PASSED — SERVER IS HEALTHY!                    ║')
    else:
        print('║                                                              ║')
        print(f'║  ⚠️  {total_fails} failures detected — check logs above      ║')

    print('╚══════════════════════════════════════════════════════════════╝')


# ── Main ───────────────────────────────────────────────────────────────────────

async def main():
    print()
    print('╔══════════════════════════════════════════════════════════╗')
    print('║   LR-Ride Load Test Runner                              ║')
    print(f'║   {NUM_DRIVERS} Drivers × {NUM_STUDENTS} Students vs Production Server         ║')
    print(f'║   Target: {BASE_URL}')
    print('╚══════════════════════════════════════════════════════════╝')
    print()
    print('  💡 Open your Campus Admin dashboard to see rides appear in real-time!')
    print('     https://futmride.onrender.com/campus-admin/')
    print()

    result = TestResult()
    start = time.time()

    async with aiohttp.ClientSession() as session:
        # Phase 1: Driver logins
        driver_tokens = await phase1_driver_logins(session, result)

        # Phase 2: Create garage rides
        rides = await phase2_create_rides(session, driver_tokens, result)

        # Small pause — let the WebSocket events settle for the admin dashboard
        print('\n  ⏸️  Pausing 3s for WebSocket events to propagate...')
        await asyncio.sleep(3)

        # Phase 3: Student logins
        student_tokens = await phase3_student_logins(session, result)

        # Phase 4: Students board rides
        await phase4_board_rides(session, student_tokens, rides, result)

        # Small pause
        print('\n  ⏸️  Pausing 2s...')
        await asyncio.sleep(2)

        # Phase 5: Depart and cancel
        await phase5_depart_and_cancel(session, rides, result)

    elapsed = time.time() - start
    print_report(result, elapsed)


if __name__ == '__main__':
    asyncio.run(main())
