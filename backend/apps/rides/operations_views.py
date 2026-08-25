from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from apps.accounts.permissions import IsAdminOrCampusAdmin
from apps.rides.models import Ride
from apps.rides.scheduled_models import ScheduledRidePassenger
from apps.rides.garage_models import GarageRidePassenger
from apps.rides.garage_models import GarageRidePassenger
from dateutil.parser import parse as parse_date
import json
class AdminLivePassengersView(APIView):
    """
    Returns today's passengers across both scheduled and garage rides 
    for the Operations Hub.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        today = timezone.now().date()
        
        scheduled_pax = ScheduledRidePassenger.objects.filter(
            ride__departure_date=today
        ).select_related('student', 'ride', 'boarding_stop', 'alighting_stop').order_by('-joined_at')
        
        garage_pax = GarageRidePassenger.objects.filter(
            garage_ride__created_at__date=today
        ).select_related('student', 'garage_ride').order_by('-boarded_at')

        data = []
        for p in scheduled_pax:
            if p.boarding_stop and p.alighting_stop:
                route_str = f"{p.boarding_stop.name} -> {p.alighting_stop.name}"
            else:
                route_str = f"{p.ride.origin_address} -> {p.ride.destination_address}"
                
            data.append({
                'id': str(p.id),
                'name': p.student.full_name,
                'ticket_ref': p.ticket_ref,
                'route': route_str,
                'time': p.ride.window_start.strftime('%H:%M') if p.ride.window_start else '',
                'status': p.status,
                'amount_paid': str(p.amount_paid or 0),
                'payment_method': 'Wallet',
                'type': 'Scheduled',
            })
            
        for p in garage_pax:
            data.append({
                'id': str(p.id),
                'name': p.student.full_name,
                'ticket_ref': p.ticket_ref,
                'route': f"{p.garage_ride.origin_address} -> {p.garage_ride.destination_address}",
                'time': p.boarded_at.strftime('%Y-%m-%d %H:%M') if p.boarded_at else '',
                'status': 'Confirmed',
                'amount_paid': str(p.amount_paid or 0),
                'payment_method': 'Wallet',
                'type': 'Garage',
            })
            
        return Response({'results': data})

class TicketVerificationView(APIView):
    """
    Verifies a 6-character short ticket across both ride models.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, ticket_ref):
        ticket_ref = ticket_ref.strip().upper()
        if not ticket_ref.startswith('TCK-'):
            ticket_ref = f"TCK-{ticket_ref}"
            
        sp = ScheduledRidePassenger.objects.filter(ticket_ref=ticket_ref).select_related('student', 'ride', 'boarding_stop', 'alighting_stop').first()
        if sp:
            if sp.boarding_stop and sp.alighting_stop:
                route_str = f"{sp.boarding_stop.name} -> {sp.alighting_stop.name}"
            else:
                route_str = f"{sp.ride.origin_address} -> {sp.ride.destination_address}"
                
            return Response({
                'valid': True,
                'type': 'Scheduled',
                'passenger_name': sp.student.full_name,
                'status': sp.status,
                'route': route_str,
                'time': sp.ride.window_start.strftime('%H:%M') if sp.ride.window_start else '',
            })
            
        gp = GarageRidePassenger.objects.filter(ticket_ref=ticket_ref).select_related('student', 'garage_ride').first()
        if gp:
            return Response({
                'valid': True,
                'type': 'Garage',
                'passenger_name': gp.student.full_name,
                'status': 'Confirmed',
                'route': f"{gp.garage_ride.origin_address} -> {gp.garage_ride.destination_address}",
                'time': gp.boarded_at.strftime('%Y-%m-%d %H:%M') if gp.boarded_at else '',
            })
            
        return Response({'valid': False, 'message': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)

class AdminRideActivityLogView(APIView):
    """
    Returns a unified activity log across On-Demand, Scheduled, and Garage rides.
    Supports cursor pagination and advanced filtering.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        params = request.query_params
        cursor = params.get('cursor')
        page_size = int(params.get('page_size', 50))
        
        # Filters
        ride_type = params.get('ride_type')
        status_filter = params.get('status')
        event_filter = params.get('event')
        date_from = params.get('date_from')
        date_to = params.get('date_to')
        student = params.get('student')
        driver = params.get('driver')
        reference = params.get('reference')
        
        cursor_dt = None
        cursor_id = None
        if cursor and '__' in cursor:
            dt_str, cursor_id = cursor.split('__', 1)
            try:
                cursor_dt = parse_date(dt_str)
            except ValueError:
                pass
                
        allowed_types = ride_type.split(',') if ride_type else ['on_demand', 'scheduled', 'garage']
        
        events = []
        
        # 1. On-Demand Rides
        if 'on_demand' in allowed_types:
            q = Ride.objects.select_related('student', 'driver')
            
            if date_from: q = q.filter(updated_at__gte=parse_date(date_from))
            if date_to: q = q.filter(updated_at__lte=parse_date(date_to))
            if status_filter: q = q.filter(status__in=status_filter.split(','))
            if student: q = q.filter(student__first_name__icontains=student) | q.filter(student__last_name__icontains=student)
            if driver: q = q.filter(driver__first_name__icontains=driver) | q.filter(driver__last_name__icontains=driver)
            if reference: q = q.filter(reference__icontains=reference)
            
            if cursor_dt:
                q = q.filter(updated_at__lte=cursor_dt).exclude(updated_at=cursor_dt, id__gte=cursor_id)
                
            q = q.order_by('-updated_at')[:page_size]
            
            for r in q:
                events.append({
                    'id': str(r.id),
                    'timestamp': r.updated_at.isoformat(),
                    'event': r.status,
                    'event_label': r.get_status_display(),
                    'ride_type': 'on_demand',
                    'reference': r.reference,
                    'student_name': r.student.full_name,
                    'driver_name': r.driver.full_name if r.driver else '',
                    'route': f"{r.pickup_address} → {r.dropoff_address}",
                    'amount': str(r.total_fare or 0),
                    'status': r.status,
                    'ride_id': str(r.id)
                })

        # 2. Scheduled Rides
        if 'scheduled' in allowed_types:
            q = ScheduledRidePassenger.objects.select_related('student', 'ride', 'ride__assigned_driver', 'boarding_stop', 'alighting_stop')
            
            if date_from: q = q.filter(joined_at__gte=parse_date(date_from))
            if date_to: q = q.filter(joined_at__lte=parse_date(date_to))
            if status_filter: q = q.filter(status__in=status_filter.split(','))
            if student: q = q.filter(student__first_name__icontains=student) | q.filter(student__last_name__icontains=student)
            if driver: q = q.filter(ride__assigned_driver__first_name__icontains=driver) | q.filter(ride__assigned_driver__last_name__icontains=driver)
            if reference: q = q.filter(ride__reference__icontains=reference)
            
            if cursor_dt:
                q = q.filter(joined_at__lte=cursor_dt).exclude(joined_at=cursor_dt, id__gte=cursor_id)
                
            q = q.order_by('-joined_at')[:page_size]
            
            for r in q:
                events.append({
                    'id': str(r.id),
                    'timestamp': r.joined_at.isoformat(),
                    'event': r.status,
                    'event_label': r.get_status_display(),
                    'ride_type': 'scheduled',
                    'reference': r.ride.reference,
                    'student_name': r.student.full_name,
                    'driver_name': r.ride.assigned_driver.full_name if r.ride.assigned_driver else '',
                    'route': f"{r.boarding_stop.name if r.boarding_stop else r.ride.origin_address} → {r.alighting_stop.name if r.alighting_stop else r.ride.destination_address}",
                    'amount': str(r.amount_paid or 0),
                    'status': r.status,
                    'ride_id': str(r.ride.id)
                })

        # 3. Garage Rides
        if 'garage' in allowed_types:
            q = GarageRidePassenger.objects.select_related('student', 'garage_ride', 'garage_ride__driver')
            
            if date_from: q = q.filter(boarded_at__gte=parse_date(date_from))
            if date_to: q = q.filter(boarded_at__lte=parse_date(date_to))
            
            if student: q = q.filter(student__first_name__icontains=student) | q.filter(student__last_name__icontains=student)
            if driver: q = q.filter(garage_ride__driver__first_name__icontains=driver) | q.filter(garage_ride__driver__last_name__icontains=driver)
            if reference: q = q.filter(garage_ride__reference__icontains=reference)
            
            if cursor_dt:
                q = q.filter(boarded_at__lte=cursor_dt).exclude(boarded_at=cursor_dt, id__gte=cursor_id)
                
            q = q.order_by('-boarded_at')[:page_size]
            
            for r in q:
                events.append({
                    'id': str(r.id),
                    'timestamp': r.boarded_at.isoformat(),
                    'event': 'boarded',
                    'event_label': 'Boarded',
                    'ride_type': 'garage',
                    'reference': r.garage_ride.reference,
                    'student_name': r.student.full_name,
                    'driver_name': r.garage_ride.driver.full_name,
                    'route': f"{r.garage_ride.origin_address} → {r.garage_ride.destination_address}",
                    'amount': str(r.amount_paid or 0),
                    'status': r.garage_ride.status,
                    'ride_id': str(r.garage_ride.id)
                })

        # Sort combined events by timestamp desc
        events.sort(key=lambda x: x['timestamp'], reverse=True)
        
        if event_filter:
            allowed_events = event_filter.split(',')
            events = [e for e in events if e['event'] in allowed_events]
            
        results = events[:page_size]
        
        has_next = len(events) > page_size
        next_cursor = f"{results[-1]['timestamp']}__{results[-1]['id']}" if results else None
        
        return Response({
            'results': results,
            'next_cursor': next_cursor,
            'has_next': has_next
        })
