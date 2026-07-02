from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from apps.accounts.permissions import IsAdminUser
from apps.rides.scheduled_models import ScheduledRidePassenger
from apps.rides.garage_models import GarageRidePassenger

class AdminLivePassengersView(APIView):
    """
    Returns today's passengers across both scheduled and garage rides 
    for the Operations Hub.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

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
