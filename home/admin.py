from django.contrib import admin
from .models import AdminSettings, Guests

admin.site.register([AdminSettings, Guests])