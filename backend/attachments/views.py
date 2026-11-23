import os
import mimetypes
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.shortcuts import get_object_or_404
from .models import Attachment
from .serializers import AttachmentSerializer
from conversations.models import Conversation

ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv', 'application/zip', 'application/x-zip-compressed'
]

MAX_FILE_SIZE = getattr(settings, 'MAX_UPLOAD_SIZE', 10 * 1024 * 1024)

class AttachmentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        conversation_id = request.data.get('conversation_id')

        if not uploaded_file:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        if not conversation_id:
            return Response({'error': 'conversation_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        conversation = get_object_or_404(
            Conversation.objects.filter(memberships__user=request.user),
            id=conversation_id
        )

        if uploaded_file.size > MAX_FILE_SIZE:
            return Response(
                {'error': f'File size exceeds limit of {MAX_FILE_SIZE // (1024 * 1024)}MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        content_type = uploaded_file.content_type
        if not content_type or content_type == 'application/octet-stream':
            guessed_type, _ = mimetypes.guess_type(uploaded_file.name)
            if guessed_type:
                content_type = guessed_type

        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext in ['.exe', '.bat', '.sh', '.dll', '.msi', '.vbs', '.cmd']:
            return Response({'error': 'File type is not permitted for security reasons.'}, status=status.HTTP_400_BAD_REQUEST)

        is_image = content_type.startswith('image/') if content_type else False

        attachment = Attachment.objects.create(
            conversation=conversation,
            uploader=request.user,
            file=uploaded_file,
            original_name=uploaded_file.name,
            file_size=uploaded_file.size,
            mime_type=content_type or 'application/octet-stream',
            is_image=is_image
        )

        serializer = AttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
