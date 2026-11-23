import json
from django.test import TransactionTestCase
from django.contrib.auth import get_user_model
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
from config.asgi import application
from conversations.models import Conversation, ConversationMember
from messaging.models import Message, MessageReceipt
from .models import WebSocketTicket

User = get_user_model()

class RealtimeWebSocketTests(TransactionTestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username='wsuser1',
            email='wsuser1@example.com',
            password='Password123!',
            display_name='WS User One'
        )
        self.user2 = User.objects.create_user(
            username='wsuser2',
            email='wsuser2@example.com',
            password='Password123!',
            display_name='WS User Two'
        )
        self.conversation = Conversation.objects.create(type='direct')
        ConversationMember.objects.create(conversation=self.conversation, user=self.user1)
        ConversationMember.objects.create(conversation=self.conversation, user=self.user2)

    async def test_websocket_ticket_auth_and_messaging(self):
        ticket = await database_sync_to_async(WebSocketTicket.create_ticket)(self.user1)

        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/?ticket={ticket.ticket}"
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to({
            'type': 'message.send',
            'conversation_id': str(self.conversation.id),
            'text': 'Hello via WebSocket!',
            'idempotency_key': 'ws-key-1'
        })

        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'message.new')
        self.assertEqual(response['message']['text'], 'Hello via WebSocket!')
        self.assertEqual(response['message']['sender']['username'], 'wsuser1')

        await communicator.send_json_to({
            'type': 'typing.start',
            'conversation_id': str(self.conversation.id)
        })

        await communicator.disconnect()

    async def test_unauthenticated_websocket_connection_rejected(self):
        communicator = WebsocketCommunicator(
            application,
            "/ws/chat/"
        )
        connected, code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4001)
