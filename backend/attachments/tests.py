from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from conversations.models import Conversation, ConversationMember
from .models import Attachment

User = get_user_model()

class AttachmentTests(TestCase):
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
        self.conversation = Conversation.objects.create(type='direct')
        ConversationMember.objects.create(conversation=self.conversation, user=self.user1)

    def test_upload_attachment_success(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('attachment_upload')

        test_file = SimpleUploadedFile(
            "test_image.png",
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82",
            content_type="image/png"
        )

        response = self.client.post(
            url,
            {'file': test_file, 'conversation_id': str(self.conversation.id)},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['original_name'], 'test_image.png')
        self.assertTrue(response.data['is_image'])
        self.assertIn('file_url', response.data)

    def test_upload_attachment_unauthorized_user(self):
        self.client.force_authenticate(user=self.user2)
        url = reverse('attachment_upload')

        test_file = SimpleUploadedFile("doc.txt", b"sample content", content_type="text/plain")
        response = self.client.post(
            url,
            {'file': test_file, 'conversation_id': str(self.conversation.id)},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
