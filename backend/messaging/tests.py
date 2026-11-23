import uuid
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from conversations.models import Conversation, ConversationMember
from .models import Message, MessageReceipt

User = get_user_model()

class MessagingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='Password123!',
            display_name='User One'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='Password123!',
            display_name='User Two'
        )
        self.user3 = User.objects.create_user(
            username='user3',
            email='user3@example.com',
            password='Password123!',
            display_name='User Three'
        )

        self.conversation = Conversation.objects.create(type='direct')
        ConversationMember.objects.create(conversation=self.conversation, user=self.user1)
        ConversationMember.objects.create(conversation=self.conversation, user=self.user2)

    def test_send_message_and_idempotency(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('conversation_messages', kwargs={'conversation_id': self.conversation.id})

        payload = {
            'text': 'Hello Bob!',
            'idempotency_key': 'key-12345'
        }
        res1 = self.client.post(url, payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        msg_id = res1.data['id']
        self.assertEqual(res1.data['text'], 'Hello Bob!')

        res2 = self.client.post(url, payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['id'], msg_id)

        self.assertEqual(Message.objects.filter(conversation=self.conversation).count(), 1)

    def test_message_history_and_pagination(self):
        for i in range(5):
            Message.objects.create(
                conversation=self.conversation,
                sender=self.user1,
                text=f"Message {i}"
            )

        self.client.force_authenticate(user=self.user2)
        url = reverse('conversation_messages', kwargs={'conversation_id': self.conversation.id})
        res = self.client.get(url, {'limit': 3})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['results']), 3)
        self.assertTrue(res.data['has_more'])

    def test_message_edit_and_delete(self):
        msg = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            text="Initial text"
        )
        url = reverse('message_detail', kwargs={'message_id': msg.id})

        self.client.force_authenticate(user=self.user2)
        res_fail = self.client.patch(url, {'text': 'Hacked'}, format='json')
        self.assertEqual(res_fail.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.user1)
        res_edit = self.client.patch(url, {'text': 'Updated text'}, format='json')
        self.assertEqual(res_edit.status_code, status.HTTP_200_OK)
        self.assertEqual(res_edit.data['text'], 'Updated text')
        self.assertTrue(res_edit.data['is_edited'])

        res_del = self.client.delete(url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertEqual(res_del.data['text'], 'This message was deleted')
        self.assertTrue(res_del.data['is_deleted'])

    def test_message_read_receipt(self):
        msg = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            text="Unread message"
        )
        MessageReceipt.objects.create(message=msg, user=self.user2, status='sent')

        self.client.force_authenticate(user=self.user2)
        read_url = reverse('message_read', kwargs={'message_id': msg.id})
        res = self.client.post(read_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        receipt = MessageReceipt.objects.get(message=msg, user=self.user2)
        self.assertEqual(receipt.status, 'read')
