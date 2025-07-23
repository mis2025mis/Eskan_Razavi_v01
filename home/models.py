from django.db import models
import jdatetime
# Create your models here.
from django.utils.timezone import localtime

class AdminSettings(models.Model):
    title = models.CharField(max_length=100)
    capactiy = models.PositiveBigIntegerField(default=0)
    each_person_time = models.PositiveBigIntegerField(default=24)
    active_guests = models.PositiveBigIntegerField(default=0)
    highest_settlement_time = models.PositiveBigIntegerField(default=24)

    def __str__(self):
        return self.title
    

class Guests(models.Model):
    name = models.CharField(max_length=50)
    family = models.CharField(max_length=50)
    UID = models.PositiveBigIntegerField(default=0)
    enter_time = models.DateTimeField(auto_now_add=True)
    formated_enter_time = models.CharField(max_length=50, null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)
    formated_duration = models.CharField(max_length=50, null=True, blank=True)

    def __str__(self):
        return self.name + " " + self.family


    def update_formatted_duration(self):
        if self.duration:
            total_seconds = int(self.duration.total_seconds())
            days = total_seconds // 86400
            hours = (total_seconds % 86400) // 3600
            minutes = (total_seconds % 3600) // 60
            seconds = total_seconds % 60
            parts = []
            if days:
                parts.append(f"{days} روز")
            if hours:
                parts.append(f"{hours} ساعت")
            if minutes:
                parts.append(f"{minutes} دقیقه")
            if seconds:
                parts.append(f"{seconds} ثانیه")
            self.formated_duration = " و ".join(parts) if parts else "0 ثانیه"
        else:
            self.formated_duration = "0 ثانیه"
        self.save()

    def save(self, *args, **kwargs):
        if self.enter_time:
            local_dt = localtime(self.enter_time)
            jalali_datetime = jdatetime.datetime.fromgregorian(datetime=local_dt)
            hour = jalali_datetime.hour
            minute = jalali_datetime.minute
            meridiem = "ق.ظ" if hour < 12 else "ب.ظ"
            hour_12 = hour % 12 or 12
            time_string = f"{hour_12:02d}:{minute:02d} {meridiem}"
            self.formated_enter_time = jalali_datetime.strftime(f"%Y/%m/%d - {time_string}")
        else:
            self.formated_enter_time = "-"
        super().save(*args, **kwargs)


