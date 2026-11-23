from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    LogoutView,
    MeView,
    UserSearchView,
    UserDetailView,
    WebSocketTicketView,
)

urlpatterns = [
    # Auth endpoints
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='auth_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='auth_logout'),
    path('auth/me/', MeView.as_view(), name='auth_me'),
    path('auth/ws-ticket/', WebSocketTicketView.as_view(), name='auth_ws_ticket'),

    # User endpoints
    path('users/search/', UserSearchView.as_view(), name='users_search'),
    path('users/<uuid:id>/', UserDetailView.as_view(), name='user_detail'),
]
