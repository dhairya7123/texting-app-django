import uuid
from datetime import timedelta
from django.db import models
from django.conf import settings
from django.utils import timezone

class WebSocketTicket(models.Model):
    ticket = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ws_tickets'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    @classmethod
    def create_ticket(cls, user, lifetime_seconds=60):
        expires_at = timezone.now() + timedelta(seconds=lifetime_seconds)
        return cls.objects.create(user=user, expires_at=expires_at)

    def is_valid(self):
        return (not self.is_used) and (timezone.now() <= self.expires_at)

    def __str__(self):
        return f"Ticket {self.ticket} for {self.user.username}"
