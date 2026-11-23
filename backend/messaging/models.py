import uuid
from django.db import models
from django.conf import settings
from conversations.models import Conversation

class Message(models.Model):
    MESSAGE_TYPES = (
        ('text', 'Text'),
        ('attachment', 'Attachment'),
        ('system', 'System'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    text = models.TextField(blank=True, default='')
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='text')
    idempotency_key = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['conversation', 'idempotency_key']),
        ]

    def __str__(self):
        return f"Msg {self.id} by {self.sender.username} in {self.conversation.id}"


class MessageReceipt(models.Model):
    RECEIPT_STATUSES = (
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('read', 'Read'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='receipts'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='message_receipts'
    )
    status = models.CharField(max_length=15, choices=RECEIPT_STATUSES, default='sent')
    timestamp = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('message', 'user')
        indexes = [
            models.Index(fields=['message', 'user']),
            models.Index(fields=['message', 'status']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.message.id}: {self.status}"
