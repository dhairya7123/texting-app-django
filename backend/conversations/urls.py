from django.urls import path
from .views import (
    ConversationListCreateView,
    ConversationDetailView,
    ConversationMembersView,
    ConversationMemberDetailView,
)

urlpatterns = [
    path('conversations/', ConversationListCreateView.as_view(), name='conversation_list_create'),
    path('conversations/<uuid:pk>/', ConversationDetailView.as_view(), name='conversation_detail'),
    path('conversations/<uuid:pk>/members/', ConversationMembersView.as_view(), name='conversation_members'),
    path('conversations/<uuid:pk>/members/<uuid:user_id>/', ConversationMemberDetailView.as_view(), name='conversation_member_detail'),
]
