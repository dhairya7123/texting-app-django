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

async def receive_event(comm, expected_type, timeout=2):
    while True:
        msg = await comm.receive_json_from(timeout=timeout)
        if msg.get('type') == expected_type:
            return msg

class FullRealtimeIntegrationTests(TransactionTestCase):
    def setUp(self):
        self.alice = User.objects.create_user(
            username='alice',
            email='alice@test.com',
            password='Password123!',
            display_name='Alice Wonderland'
        )
        self.bob = User.objects.create_user(
            username='bob',
            email='bob@test.com',
            password='Password123!',
            display_name='Bob Builder'
        )
        self.charlie = User.objects.create_user(
            username='charlie',
            email='charlie@test.com',
            password='Password123!',
            display_name='Charlie Chaplin'
        )

        self.direct_conv = Conversation.objects.create(type='direct')
        ConversationMember.objects.create(conversation=self.direct_conv, user=self.alice)
        ConversationMember.objects.create(conversation=self.direct_conv, user=self.bob)

        self.group_conv = Conversation.objects.create(type='group', name='The A-Team')
        ConversationMember.objects.create(conversation=self.group_conv, user=self.alice, role='admin')
        ConversationMember.objects.create(conversation=self.group_conv, user=self.bob, role='member')
        ConversationMember.objects.create(conversation=self.group_conv, user=self.charlie, role='member')

    async def test_full_two_user_messaging_lifecycle(self):
        ticket_alice = await database_sync_to_async(WebSocketTicket.create_ticket)(self.alice)
        ticket_bob = await database_sync_to_async(WebSocketTicket.create_ticket)(self.bob)

        comm_alice = WebsocketCommunicator(application, f"/ws/chat/?ticket={ticket_alice.ticket}")
        comm_bob = WebsocketCommunicator(application, f"/ws/chat/?ticket={ticket_bob.ticket}")

        connected_a, _ = await comm_alice.connect()
        connected_b, _ = await comm_bob.connect()
        self.assertTrue(connected_a)
        self.assertTrue(connected_b)

        await comm_alice.send_json_to({
            'type': 'message.send',
            'conversation_id': str(self.direct_conv.id),
            'text': 'Hi Bob, how are you?',
            'idempotency_key': 'alice-msg-1'
        })

        alice_received = await receive_event(comm_alice, 'message.new')
        self.assertEqual(alice_received['type'], 'message.new')
        self.assertEqual(alice_received['message']['text'], 'Hi Bob, how are you?')
        msg_id = alice_received['message']['id']

        bob_received = await receive_event(comm_bob, 'message.new')
        self.assertEqual(bob_received['type'], 'message.new')
        self.assertEqual(bob_received['message']['text'], 'Hi Bob, how are you?')
        self.assertEqual(bob_received['message']['sender']['username'], 'alice')

        await comm_bob.send_json_to({
            'type': 'message.delivered',
            'message_id': msg_id,
            'conversation_id': str(self.direct_conv.id)
        })

        alice_delivery_update = await receive_event(comm_alice, 'message.delivered')
        self.assertEqual(alice_delivery_update['receipt']['status'], 'delivered')

        await comm_bob.send_json_to({
            'type': 'message.read',
            'message_id': msg_id,
            'conversation_id': str(self.direct_conv.id)
        })

        alice_read_update = await receive_event(comm_alice, 'message.read')
        self.assertEqual(alice_read_update['receipt']['status'], 'read')

        await comm_bob.send_json_to({
            'type': 'typing.start',
            'conversation_id': str(self.direct_conv.id)
        })

        alice_typing = await receive_event(comm_alice, 'typing.update')
        self.assertEqual(alice_typing['username'], 'bob')
        self.assertTrue(alice_typing['is_typing'])

        await comm_alice.disconnect()
        await comm_bob.disconnect()

    async def test_group_broadcast_messaging(self):
        t_alice = await database_sync_to_async(WebSocketTicket.create_ticket)(self.alice)
        t_bob = await database_sync_to_async(WebSocketTicket.create_ticket)(self.bob)
        t_charlie = await database_sync_to_async(WebSocketTicket.create_ticket)(self.charlie)

        comm_alice = WebsocketCommunicator(application, f"/ws/chat/?ticket={t_alice.ticket}")
        comm_bob = WebsocketCommunicator(application, f"/ws/chat/?ticket={t_bob.ticket}")
        comm_charlie = WebsocketCommunicator(application, f"/ws/chat/?ticket={t_charlie.ticket}")

        await comm_alice.connect()
        await comm_bob.connect()
        await comm_charlie.connect()

        await comm_alice.send_json_to({
            'type': 'message.send',
            'conversation_id': str(self.group_conv.id),
            'text': 'Welcome everyone to The A-Team!',
            'idempotency_key': 'group-msg-1'
        })

        a_msg = await receive_event(comm_alice, 'message.new')
        self.assertEqual(a_msg['type'], 'message.new')

        b_msg = await receive_event(comm_bob, 'message.new')
        self.assertEqual(b_msg['type'], 'message.new')
        self.assertEqual(b_msg['message']['text'], 'Welcome everyone to The A-Team!')

        c_msg = await receive_event(comm_charlie, 'message.new')
        self.assertEqual(c_msg['type'], 'message.new')
        self.assertEqual(c_msg['message']['text'], 'Welcome everyone to The A-Team!')

        await comm_alice.disconnect()
        await comm_bob.disconnect()
        await comm_charlie.disconnect()
