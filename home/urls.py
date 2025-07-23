from django.urls import path
from . import views

urlpatterns = [
    path('', views.home_page_view, name='home'),
    path("set_admin_settings/", views.set_admin_settings, name="set_admin_settings"),
    path("set_guest/", views.set_guest, name="set_guest"),
    path("admin_page/", views.admin_page, name="admin_page"),
    path("exit_page/", views.exit_page, name="exit_page"),
    path("set_exit_page/", views.set_exit_page, name="set_exit_page"),
    path("set_exit/", views.set_exit, name="set_exit"),
]