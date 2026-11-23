import uuid
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Conversation, ConversationMember

User = get_user_model()

class ConversationTests(TestCase):
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

    def test_create_and_prevent_duplicate_direct_conversation(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('conversation_list_create')

        payload = {
            'type': 'direct',
            'recipient_id': str(self.user2.id)
        }
        res1 = self.client.post(url, payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        conv1_id = res1.data['id']

        res2 = self.client.post(url, payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['id'], conv1_id)

        self.client.force_authenticate(user=self.user2)
        payload_reverse = {
            'type': 'direct',
            'recipient_id': str(self.user1.id)
        }
        res3 = self.client.post(url, payload_reverse, format='json')
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        self.assertEqual(res3.data['id'], conv1_id)

    def test_group_conversation_creation_and_member_management(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('conversation_list_create')

        payload = {
            'type': 'group',
            'name': 'Project Team',
            'member_ids': [str(self.user2.id)]
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        group_id = res.data['id']
        self.assertEqual(res.data['name'], 'Project Team')

        members_url = reverse('conversation_members', kwargs={'pk': group_id})
        members_res = self.client.get(members_url)
        self.assertEqual(members_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(members_res.data), 2)

        self.client.force_authenticate(user=self.user2)
        add_res = self.client.post(members_url, {'user_ids': [str(self.user3.id)]}, format='json')
        self.assertEqual(add_res.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.user1)
        add_res_admin = self.client.post(members_url, {'user_ids': [str(self.user3.id)]}, format='json')
        self.assertEqual(add_res_admin.status_code, status.HTTP_201_CREATED)

        remove_url = reverse('conversation_member_detail', kwargs={'pk': group_id, 'user_id': self.user3.id})
        del_res = self.client.delete(remove_url)
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)

        members_check = self.client.get(members_url)
        self.assertEqual(len(members_check.data), 2)
