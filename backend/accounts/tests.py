import uuid
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()

class AccountsAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='alice',
            email='alice@example.com',
            password='Password123!',
            display_name='Alice Wonderland',
            status_message='Available'
        )
        self.user2 = User.objects.create_user(
            username='bob',
            email='bob@example.com',
            password='Password123!',
            display_name='Bob Builder',
            status_message='Busy'
        )

    def test_user_registration(self):
        url = reverse('auth_register')
        data = {
            'username': 'charlie',
            'email': 'charlie@example.com',
            'password': 'Password123!',
            'password_confirm': 'Password123!',
            'display_name': 'Charlie Chaplin',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['username'], 'charlie')

    def test_user_login(self):
        url = reverse('auth_login')
        data = {
            'username': 'alice',
            'password': 'Password123!'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['username'], 'alice')

    def test_user_profile_me(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('auth_me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'alice')
        self.assertEqual(response.data['display_name'], 'Alice Wonderland')

        update_data = {
            'display_name': 'Alice In Tech',
            'status_message': 'Coding real-time apps'
        }
        patch_response = self.client.patch(url, update_data, format='json')
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data['display_name'], 'Alice In Tech')
        self.assertEqual(patch_response.data['status_message'], 'Coding real-time apps')

    def test_user_search(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('users_search')
        response = self.client.get(url, {'q': 'bob'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['username'], 'bob')

    def test_ws_ticket_generation(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('auth_ws_ticket')
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('ticket', response.data)
