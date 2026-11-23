import urllib.parse
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from .models import WebSocketTicket

User = get_user_model()

@database_sync_to_async
def get_user_from_ticket(ticket_str):
    try:
        ws_ticket = WebSocketTicket.objects.select_related('user').filter(
            ticket=ticket_str,
            is_used=False
        ).first()
        if ws_ticket and ws_ticket.is_valid():
            ws_ticket.is_used = True
            ws_ticket.save(update_fields=['is_used'])
            return ws_ticket.user
    except Exception:
        pass
    return None

@database_sync_to_async
def get_user_from_jwt(token_str):
    try:
        token = AccessToken(token_str)
        user_id = token.get('user_id')
        if user_id:
            return User.objects.filter(id=user_id).first()
    except Exception:
        pass
    return None


class TicketAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode('utf-8')
        params = urllib.parse.parse_qs(query_string)

        ticket = params.get('ticket', [None])[0]
        token = params.get('token', [None])[0]

        user = None
        if ticket:
            user = await get_user_from_ticket(ticket)
        elif token:
            user = await get_user_from_jwt(token)

        scope['user'] = user if user else AnonymousUser()
        return await self.inner(scope, receive, send)
