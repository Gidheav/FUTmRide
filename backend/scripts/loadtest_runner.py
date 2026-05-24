"""
LR-Ride Load Test Runner
Simulates drivers creating garage rides + students scanning & boarding.
Runs sequentially via asyncio + aiohttp against the LIVE Render server.

Prerequisites:
  1. Run loadtest_seed.py on Render first (creates the test accounts)
  2. pip install aiohttp

Usage:
  $env:PYTHONIOENCODING="utf-8"; python scripts/loadtest_runner.py
"""
import asyncio
import aiohttp
import random
import time
import sys
from dataclasses import dataclass, field
from typing import Optional

# -- Config --
BASE_URL = 'https://futmride.onrender.com/api/v1'
PASSWORD = 'LoadTest2026!'
NUM_DRIVERS = 5
NUM_STUDENTS = 15
STUDENTS_PER_RIDE = 3

# Fully sequential to be gentle on Render Free (0.1 CPU)
TIMEOUT = aiohttp.ClientTimeout(total=60)


@dataclass
class TestResult:
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


def driver_phone(i: int) -> str:
    return f'+23480100{i:05d}'

def student_email(i: int) -> str:
    return f'loadtest.m{i:07d}@st.futminna.edu.ng'

def log(msg: str):
    sys.stdout.write(f'  {msg}\n')
    sys.stdout.flush()


async def login_phone(session: aiohttp.ClientSession, phone: str) -> tuple:
    """Log in with phone number. Returns (access_token, error_string)."""
    try:
        async with session.post(f'{BASE_URL}/auth/login/', json={
            'phone_number': phone,
            'password': PASSWORD,
        }, timeout=TIMEOUT) as resp:
            body = await resp.text()
            if resp.status == 200:
                data = await resp.json(content_type=None)
                return data.get('access'), None
            else:
                return None, f'HTTP {resp.status}: {body[:150]}'
    except asyncio.TimeoutError:
        return None, 'TIMEOUT (60s)'
    except Exception as e:
        return None, f'Exception: {str(e)[:100]}'


async def login_email(session: aiohttp.ClientSession, email: str) -> tuple:
    """Log in with email (for students). Returns (access_token, error_string)."""
    try:
        async with session.post(f'{BASE_URL}/auth/login/', json={
            'email': email,
            'password': PASSWORD,
        }, timeout=TIMEOUT) as resp:
            body = await resp.text()
            if resp.status == 200:
                data = await resp.json(content_type=None)
                return data.get('access'), None
            else:
                return None, f'HTTP {resp.status}: {body[:150]}'
    except asyncio.TimeoutError:
        return None, 'TIMEOUT (60s)'
    except Exception as e:
        return None, f'Exception: {str(e)[:100]}'


async def create_garage_ride(session: aiohttp.ClientSession, token: str, driver_idx: int) -> tuple:
    """Driver creates a garage ride. Returns (ride_data_dict, error_string)."""
    origins = [
        ('Main Gate', 9.5363, 6.4506),
        ('Gidan Kwano', 9.5323, 6.4526),
        ('Hostel Area', 9.5410, 6.4490),
        ('Market Area', 9.5250, 6.4480),
        ('Bosso Campus', 9.6175, 6.5508),
    ]
    dests = [
        ('Lecture Hall Complex', 9.5340, 6.4550),
        ('Library', 9.5310, 6.4540),
        ('Senate Building', 9.5350, 6.4510),
        ('Engineering Faculty', 9.5380, 6.4570),
        ('Science Faculty', 9.5290, 6.4530),
    ]

    origin = origins[driver_idx % len(origins)]
    dest = dests[driver_idx % len(dests)]

    payload = {
        'origin_address': origin[0],
        'origin_latitude': str(round(origin[1] + random.uniform(-0.002, 0.002), 6)),
        'origin_longitude': str(round(origin[2] + random.uniform(-0.002, 0.002), 6)),
        'destination_address': dest[0],
        'destination_latitude': str(round(dest[1] + random.uniform(-0.002, 0.002), 6)),
        'destination_longitude': str(round(dest[2] + random.uniform(-0.002, 0.002), 6)),
        'vehicle_type': random.choice(['sedan', 'suv', 'minivan']),
        'total_seats': random.randint(3, 6),
        'fare_per_seat': str(random.choice([100, 150, 200, 250, 300, 500])),
        'driver_note': f'Load test ride #{driver_idx}',
    }

    try:
        async with session.post(f'{BASE_URL}/rides/garage/create/', json=payload,
                                headers={'Authorization': f'Bearer {token}'},
                                timeout=TIMEOUT) as resp:
            body = await resp.text()
            if resp.status == 201:
                import json
                return json.loads(body), None
            else:
                return None, f'HTTP {resp.status}: {body[:200]}'
    except asyncio.TimeoutError:
        return None, 'TIMEOUT (60s)'
    except Exception as e:
        return None, f'Exception: {str(e)[:100]}'


async def board_ride(session: aiohttp.ClientSession, token: str, qr_token: str, seats: int = 1) -> tuple:
    """Student boards a garage ride. Returns (success_bool, error_string)."""
    try:
        async with session.post(f'{BASE_URL}/rides/garage/scan/{qr_token}/board/',
                                json={'seats': seats},
                                headers={'Authorization': f'Bearer {token}'},
                                timeout=TIMEOUT) as resp:
            body = await resp.text()
            if resp.status == 201:
                return True, None
            else:
                return False, f'HTTP {resp.status}: {body[:150]}'
    except asyncio.TimeoutError:
        return False, 'TIMEOUT'
    except Exception as e:
        return False, f'Exception: {str(e)[:100]}'


async def depart_ride(session: aiohttp.ClientSession, token: str, ride_id: str) -> tuple:
    try:
        async with session.post(f'{BASE_URL}/rides/garage/{ride_id}/depart/',
                                headers={'Authorization': f'Bearer {token}'},
                                timeout=TIMEOUT) as resp:
            body = await resp.text()
            if resp.status == 200:
                return True, None
            else:
                return False, f'HTTP {resp.status}: {body[:150]}'
    except asyncio.TimeoutError:
        return False, 'TIMEOUT'
    except Exception as e:
        return False, f'Exception: {str(e)[:100]}'


async def cancel_ride(session: aiohttp.ClientSession, token: str, ride_id: str) -> tuple:
    try:
        async with session.post(f'{BASE_URL}/rides/garage/{ride_id}/cancel/',
                                headers={'Authorization': f'Bearer {token}'},
                                timeout=TIMEOUT) as resp:
            body = await resp.text()
            if resp.status == 200:
                return True, None
            else:
                return False, f'HTTP {resp.status}: {body[:150]}'
    except asyncio.TimeoutError:
        return False, 'TIMEOUT'
    except Exception as e:
        return False, f'Exception: {str(e)[:100]}'


# -- SEQUENTIAL Test Phases (one request at a time to respect 0.1 CPU) --

async def phase1_driver_logins(session, result):
    print(f'\n--- Phase 1: Driver Logins ({NUM_DRIVERS} drivers) ---')
    tokens = []
    for i in range(1, NUM_DRIVERS + 1):
        log(f'Logging in driver {i}/{NUM_DRIVERS}...')
        token, err = await login_phone(session, driver_phone(i))
        if token:
            tokens.append(token)
            result.driver_logins_ok += 1
            log(f'  OK (token: {token[:20]}...)')
        else:
            tokens.append(None)
            result.driver_logins_fail += 1
            result.errors.append(f'Driver {i}: {err}')
            log(f'  FAILED: {err}')
        await asyncio.sleep(1)  # Breathe between requests
    print(f'  Result: {result.driver_logins_ok} OK, {result.driver_logins_fail} FAILED')
    return tokens


async def phase2_create_rides(session, driver_tokens, result):
    print(f'\n--- Phase 2: Create Garage Rides ---')
    rides = []
    for i, token in enumerate(driver_tokens, 1):
        if not token:
            log(f'  Skipping driver {i} (no token)')
            continue
        log(f'Driver {i} creating ride...')
        ride_data, err = await create_garage_ride(session, token, i)
        if ride_data:
            result.rides_created += 1
            qr = ride_data.get('qr_token', 'N/A')
            rid = ride_data.get('id', 'N/A')
            result.ride_qr_tokens.append(qr)
            result.ride_ids.append(rid)
            rides.append((token, ride_data))
            log(f'  OK (id={str(rid)[:8]}... qr={str(qr)[:8]}...)')
        else:
            result.rides_failed += 1
            result.errors.append(f'Driver {i} ride: {err}')
            log(f'  FAILED: {err}')
        await asyncio.sleep(2)  # Give server time to recover
    print(f'  Result: {result.rides_created} created, {result.rides_failed} failed')
    return rides


async def phase3_student_logins(session, result):
    print(f'\n--- Phase 3: Student Logins ({NUM_STUDENTS} students) ---')
    tokens = []
    for i in range(1, NUM_STUDENTS + 1):
        log(f'Logging in student {i}/{NUM_STUDENTS} ({student_email(i)})...')
        token, err = await login_email(session, student_email(i))
        if token:
            tokens.append(token)
            result.student_logins_ok += 1
        else:
            tokens.append(None)
            result.student_logins_fail += 1
            result.errors.append(f'Student {i}: {err}')
            log(f'  FAILED: {err}')
        await asyncio.sleep(3)  # Longer delay to avoid rate limiter
    print(f'  Result: {result.student_logins_ok} OK, {result.student_logins_fail} FAILED')
    return tokens


async def phase4_board_rides(session, student_tokens, rides, result):
    print(f'\n--- Phase 4: Students Board Rides ---')
    if not result.ride_qr_tokens:
        print('  No rides to board -- skipping')
        return

    valid_students = [t for t in student_tokens if t]
    board_count = 0

    for ride_idx, qr_token in enumerate(result.ride_qr_tokens):
        start = ride_idx * STUDENTS_PER_RIDE
        end = start + STUDENTS_PER_RIDE
        for si, student_token in enumerate(valid_students[start:end]):
            board_count += 1
            log(f'Student boarding ride {ride_idx+1} ({board_count})...')
            ok, err = await board_ride(session, student_token, qr_token)
            if ok:
                result.boards_ok += 1
                log(f'  OK')
            else:
                result.boards_fail += 1
                result.errors.append(f'Board {board_count}: {err}')
                log(f'  FAILED: {err}')
            await asyncio.sleep(1)

    print(f'  Result: {result.boards_ok} boarded, {result.boards_fail} failed')


async def phase5_depart_and_cancel(session, rides, result):
    print(f'\n--- Phase 5: Depart & Cancel ---')
    if not rides:
        print('  No rides -- skipping')
        return

    depart_count = max(1, int(len(rides) * 0.6))
    cancel_count = max(1, int(len(rides) * 0.2))

    for i in range(depart_count):
        token, ride_data = rides[i]
        ride_id = ride_data.get('id')
        log(f'Departing ride {i+1} (id={str(ride_id)[:8]}...)...')
        ok, err = await depart_ride(session, token, ride_id)
        if ok:
            result.departs_ok += 1
            log(f'  OK')
        else:
            result.departs_fail += 1
            result.errors.append(f'Depart {i+1}: {err}')
            log(f'  FAILED: {err}')
        await asyncio.sleep(1)

    for i in range(depart_count, depart_count + cancel_count):
        if i >= len(rides):
            break
        token, ride_data = rides[i]
        ride_id = ride_data.get('id')
        log(f'Cancelling ride {i+1} (id={str(ride_id)[:8]}...)...')
        ok, err = await cancel_ride(session, token, ride_id)
        if ok:
            result.cancels_ok += 1
            log(f'  OK')
        else:
            result.cancels_fail += 1
            result.errors.append(f'Cancel {i+1}: {err}')
            log(f'  FAILED: {err}')
        await asyncio.sleep(1)

    remaining = len(rides) - depart_count - cancel_count
    print(f'  Result: {result.departs_ok} departed, {result.cancels_ok} cancelled, {max(0,remaining)} still open')


def print_report(result, elapsed):
    total_ops = (result.driver_logins_ok + result.rides_created +
                 result.student_logins_ok + result.boards_ok +
                 result.departs_ok + result.cancels_ok)
    total_fails = (result.driver_logins_fail + result.rides_failed +
                   result.student_logins_fail + result.boards_fail +
                   result.departs_fail + result.cancels_fail)

    print('\n')
    print('=' * 60)
    print('  LOAD TEST REPORT')
    print('=' * 60)
    print(f'  Duration:         {elapsed:.1f}s')
    print(f'  Total ops:        {total_ops} OK / {total_fails} FAILED')
    if elapsed > 0:
        print(f'  Throughput:       {total_ops / elapsed:.1f} ops/sec')
    print('-' * 60)
    print(f'  Driver logins:    {result.driver_logins_ok:>3} OK  {result.driver_logins_fail:>3} FAIL')
    print(f'  Rides created:    {result.rides_created:>3} OK  {result.rides_failed:>3} FAIL')
    print(f'  Student logins:   {result.student_logins_ok:>3} OK  {result.student_logins_fail:>3} FAIL')
    print(f'  Students boarded: {result.boards_ok:>3} OK  {result.boards_fail:>3} FAIL')
    print(f'  Rides departed:   {result.departs_ok:>3} OK  {result.departs_fail:>3} FAIL')
    print(f'  Rides cancelled:  {result.cancels_ok:>3} OK  {result.cancels_fail:>3} FAIL')
    print('-' * 60)

    if result.errors:
        print(f'  Errors (first 15):')
        for e in result.errors[:15]:
            print(f'    > {e}')

    if total_fails == 0:
        print('\n  ALL TESTS PASSED -- SERVER IS HEALTHY!')
    else:
        print(f'\n  {total_fails} failures detected.')

    print('=' * 60)


async def main():
    print()
    print('=' * 60)
    print('  LR-Ride Load Test Runner')
    print(f'  {NUM_DRIVERS} Drivers x {NUM_STUDENTS} Students')
    print(f'  Target: {BASE_URL}')
    print('=' * 60)
    print()
    print('  Open your Campus Admin dashboard to watch in real-time:')
    print('  https://futmride.onrender.com/campus-admin/')
    print()

    result = TestResult()
    start = time.time()

    async with aiohttp.ClientSession() as session:
        driver_tokens = await phase1_driver_logins(session, result)
        rides = await phase2_create_rides(session, driver_tokens, result)

        print('\n  Pausing 3s for WebSocket events to propagate...')
        await asyncio.sleep(3)

        student_tokens = await phase3_student_logins(session, result)
        await phase4_board_rides(session, student_tokens, rides, result)

        print('\n  Pausing 2s...')
        await asyncio.sleep(2)

        await phase5_depart_and_cancel(session, rides, result)

    elapsed = time.time() - start
    print_report(result, elapsed)


if __name__ == '__main__':
    asyncio.run(main())
