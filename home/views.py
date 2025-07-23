from django.shortcuts import render
from django.http import JsonResponse
from . import models
# Create your views here.
from .models import AdminSettings, Guests
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
import json
from rest_framework.serializers import ModelSerializer
from datetime import datetime
from django.utils import timezone
import math
from datetime import timedelta
from django.conf import settings
import os

def home_page_view(request):
    images_dir = os.path.join(settings.BASE_DIR, 'home', 'static', 'home', 'images')
    image_files = [f for f in os.listdir(images_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp'))]
    # Fetch last admin settings
    from .models import AdminSettings
    admin_settings = AdminSettings.objects.first()
    capacity = admin_settings.capactiy if admin_settings else 50
    each_person_time = admin_settings.each_person_time if admin_settings else 24
    context={
        'API_URL': settings.FRONTEND_API_URL,
        'background_images': image_files,
        'capacity': capacity,
        'each_person_time': each_person_time
    }
    return render(request, 'home/home.html', context=context)
   


@require_POST
def set_admin_settings(request):
    try:
        body = json.loads(request.body)
        capacity = body.get("capacity")
        each_person_time = body.get("each_person_time")
        highest_settlement_time = body.get("highest_settlement_time")
        
        if capacity is None or each_person_time is None or highest_settlement_time is None:
            return JsonResponse({"error": "Missing required fields"}, status=400)
        
        active_guests_count = Guests.objects.count()
        
        admin_settings = AdminSettings.objects.first()
        
        if not admin_settings:
            admin_settings = AdminSettings.objects.create(
                title='admin settings',
                capactiy=capacity,
                each_person_time=each_person_time,
                highest_settlement_time=highest_settlement_time,
                active_guests=active_guests_count
            )
        else:
            admin_settings.capactiy = capacity
            admin_settings.each_person_time = each_person_time
            admin_settings.highest_settlement_time = highest_settlement_time
            admin_settings.active_guests = active_guests_count
            admin_settings.save()

        return JsonResponse({"title": admin_settings.title, "status": "success"})
    
    except (json.JSONDecodeError, TypeError, ValueError):
        return JsonResponse({"error": "Invalid JSON input"}, status=400)


@require_POST
def set_guest(request):
    try:
        body = json.loads(request.body)
        uid = int(body.get("UID"))
        name = body.get("name")
        family = body.get("family")
        if not all([uid, name, family]):
            return JsonResponse({"error": "Missing required fields"}, status=400)
    except (json.JSONDecodeError, ValueError, TypeError):
        return JsonResponse({"error": "Invalid input"}, status=400)
    guest, created = Guests.objects.get_or_create(
        UID=uid,
        defaults={"name": name, "family": family}
    )
    if created:
        guest.update_formatted_duration()
        admin_settings = AdminSettings.objects.first()
        admin_settings.active_guests+=1
        admin_settings.save()
        return JsonResponse({"UID": guest.UID, "status": "created"}, status=201)
    else:
        return JsonResponse({"status": "created before"}, status=200)   



@require_GET
def admin_page(request):
    active_guests = Guests.objects.count()
    admin_settings = AdminSettings.objects.first()

    if not admin_settings:
        return JsonResponse({"error": "Admin settings not found"}, status=404)

    context = {
        "active_guests": active_guests,
        "capacity": admin_settings.capactiy,
        "highest_settlement_time": admin_settings.highest_settlement_time,
    }
    return JsonResponse(context)



class GuestSerializer(ModelSerializer):
    class Meta:
        model = Guests
        fields = "__all__"
@require_GET
def exit_page(request):
    settings = AdminSettings.objects.first()
    if not settings:
        return JsonResponse({"error": "AdminSettings not found"}, status=404)

    highest_settlement_time = settings.highest_settlement_time
    active_guests = settings.active_guests
    capactiy = settings.capactiy

    completed = active_guests / capactiy
    completed_95 = completed >= 0.95

    users = []

    if completed_95:
        twenty_four_hours = timedelta(hours=settings.highest_settlement_time)

        users = Guests.objects.filter(
                duration__gt=twenty_four_hours
            ).order_by("enter_time")

    return JsonResponse({
        "highest_settlement_time": highest_settlement_time,
        "capactiy": capactiy,
        "active_guests": active_guests,
        "percent": f'{completed * 100:.2f}',
        "completed_95": completed_95,
        "users": GuestSerializer(users, many=True).data
    })



@require_GET
def set_exit_page(request):
    all_guests = Guests.objects.all()
    for guest in all_guests:
        if guest.enter_time:
            guest.duration = timezone.now() - guest.enter_time
            guest.update_formatted_duration()
            guest.save()
        else:
            print(f"Guest {guest.id} has no entry time recorded")
    data = GuestSerializer(all_guests, many=True).data
    return JsonResponse({"Data": data})




@require_POST
def set_exit(request):
    try:
        body = json.loads(request.body)
        UID_raw = body.get("UID")

        if not UID_raw or not str(UID_raw).isdigit():
            return JsonResponse({"error": "Invalid UID"}, status=400)

        UID = int(UID_raw)
        guest = Guests.objects.filter(UID=UID).first()

        if guest is None:
            return JsonResponse({"status": "there is no such person"})
        else:
            guest.delete()
            admin_settings = AdminSettings.objects.first()
            admin_settings.active_guests-=1
            admin_settings.save()
            return JsonResponse({"status": "person removed"})

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": "Server error"}, status=500)
