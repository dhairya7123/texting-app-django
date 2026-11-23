from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from .models import Message, MessageReceipt
from conversations.models import Conversation, ConversationMember
from .serializers import MessageSerializer, CreateMessageSerializer

class ConversationMessagesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_conversation(self, conversation_id, user):
        return get_object_or_404(
            Conversation.objects.filter(memberships__user=user),
            id=conversation_id
        )

    def get(self, request, conversation_id):
        conversation = self.get_conversation(conversation_id, request.user)
        limit = int(request.query_params.get('limit', 40))
        before = request.query_params.get('before')

        messages_qs = Message.objects.filter(
            conversation=conversation
        ).select_related('sender').prefetch_related('receipts', 'receipts__user', 'attachments')

        if before:
            messages_qs = messages_qs.filter(created_at__lt=before)

        # Retrieve the latest 'limit' messages, ordered chronologically
        messages = list(messages_qs.order_by('-created_at')[:limit])
        messages.reverse()

        serializer = MessageSerializer(messages, many=True, context={'request': request})
        
        has_more = False
        if messages:
            earliest_time = messages[0].created_at
            has_more = Message.objects.filter(
                conversation=conversation,
                created_at__lt=earliest_time
            ).exists()

        return Response({
            'results': serializer.data,
            'has_more': has_more,
            'count': len(messages)
        })

    def post(self, request, conversation_id):
        conversation = self.get_conversation(conversation_id, request.user)
        serializer = CreateMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        idempotency_key = data.get('idempotency_key')
        if idempotency_key:
            existing_msg = Message.objects.filter(
                conversation=conversation,
                idempotency_key=idempotency_key
            ).first()
            if existing_msg:
                out = MessageSerializer(existing_msg, context={'request': request})
                return Response(out.data, status=status.HTTP_200_OK)

        with transaction.atomic():
            message = Message.objects.create(
                conversation=conversation,
                sender=request.user,
                text=data.get('text', ''),
                message_type=data.get('message_type', 'text'),
                idempotency_key=idempotency_key
            )

            # Create 'sent' status receipt for other members
            other_members = conversation.memberships.exclude(user=request.user)
            receipts = [
                MessageReceipt(
                    message=message,
                    user=member.user,
                    status='sent'
                )
                for member in other_members
            ]
            if receipts:
                MessageReceipt.objects.bulk_create(receipts)

            # Update conversation updated_at
            conversation.updated_at = timezone.now()
            conversation.save(update_fields=['updated_at'])

            # Update sender's last_read_at
            ConversationMember.objects.filter(
                conversation=conversation,
                user=request.user
            ).update(last_read_at=timezone.now())

        out = MessageSerializer(message, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)


class MessageDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_message(self, message_id, user):
        return get_object_or_404(
            Message.objects.filter(conversation__memberships__user=user),
            id=message_id
        )

    def get(self, request, message_id):
        message = self.get_message(message_id, request.user)
        serializer = MessageSerializer(message, context={'request': request})
        return Response(serializer.data)

    def patch(self, request, message_id):
        message = self.get_message(message_id, request.user)
        if message.sender != request.user:
            return Response({'detail': 'You can only edit your own messages.'}, status=status.HTTP_403_FORBIDDEN)
        if message.is_deleted:
            return Response({'detail': 'Cannot edit a deleted message.'}, status=status.HTTP_400_BAD_REQUEST)

        new_text = request.data.get('text', '').strip()
        if not new_text:
            return Response({'detail': 'Message text cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        message.text = new_text
        message.is_edited = True
        message.save(update_fields=['text', 'is_edited', 'updated_at'])

        serializer = MessageSerializer(message, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, message_id):
        message = self.get_message(message_id, request.user)
        if message.sender != request.user:
            return Response({'detail': 'You can only delete your own messages.'}, status=status.HTTP_403_FORBIDDEN)

        message.is_deleted = True
        message.save(update_fields=['is_deleted', 'updated_at'])
        serializer = MessageSerializer(message, context={'request': request})
        return Response(serializer.data)


class MessageReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, message_id):
        message = get_object_or_404(
            Message.objects.filter(conversation__memberships__user=request.user),
            id=message_id
        )
        now = timezone.now()

        # Update receipt for this message
        MessageReceipt.objects.update_or_create(
            message=message,
            user=request.user,
            defaults={'status': 'read', 'timestamp': now}
        )

        # Mark all unread messages in this conversation up to this message as read
        unread_receipts = MessageReceipt.objects.filter(
            message__conversation=message.conversation,
            user=request.user,
            message__created_at__lte=message.created_at
        ).exclude(status='read')
        unread_receipts.update(status='read', timestamp=now)

        # Update conversation member's last_read_at
        ConversationMember.objects.filter(
            conversation=message.conversation,
            user=request.user
        ).update(last_read_at=now)

        return Response({'message': 'Marked as read.'}, status=status.HTTP_200_OK)
