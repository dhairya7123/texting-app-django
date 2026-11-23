from django.urls import path
from .views import (
    ConversationMessagesView,
    MessageDetailView,
    MessageReadView,
)

urlpatterns = [
    path('conversations/<uuid:conversation_id>/messages/', ConversationMessagesView.as_view(), name='conversation_messages'),
    path('messages/<uuid:message_id>/', MessageDetailView.as_view(), name='message_detail'),
    path('messages/<uuid:message_id>/read/', MessageReadView.as_view(), name='message_read'),
]
