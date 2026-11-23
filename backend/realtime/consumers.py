import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from conversations.models import Conversation, ConversationMember
from messaging.models import Message, MessageReceipt
from attachments.models import Attachment
from .presence import user_connected, user_disconnected

User = get_user_model()

@database_sync_to_async
def get_user_conversations(user):
    return list(
        ConversationMember.objects.filter(user=user)
        .values_list('conversation_id', flat=True)
    )

@database_sync_to_async
def check_user_in_conversation(user, conversation_id):
    return ConversationMember.objects.filter(
        user=user,
        conversation_id=conversation_id
    ).exists()

@database_sync_to_async
def save_message_and_receipts(user, conversation_id, text, idempotency_key=None, message_type='text', attachment_ids=None):
    conversation = Conversation.objects.filter(id=conversation_id).first()
    if not conversation:
        return None, None

    if idempotency_key:
        existing = Message.objects.filter(
            conversation=conversation,
            idempotency_key=idempotency_key
        ).select_related('sender').first()
        if existing:
            return serialize_msg(existing), False

    with transaction.atomic():
        msg = Message.objects.create(
            conversation=conversation,
            sender=user,
            text=text,
            message_type=message_type,
            idempotency_key=idempotency_key
        )

        if attachment_ids:
            Attachment.objects.filter(
                id__in=attachment_ids,
                uploader=user
            ).update(message=msg, conversation=conversation)

        other_members = conversation.memberships.exclude(user=user)
        receipts = [
            MessageReceipt(message=msg, user=member.user, status='sent')
            for member in other_members
        ]
        if receipts:
            MessageReceipt.objects.bulk_create(receipts)

        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at'])

        ConversationMember.objects.filter(
            conversation=conversation,
            user=user
        ).update(last_read_at=timezone.now())

    return serialize_msg(msg), True

def serialize_msg(msg):
    attachments_data = []
    for att in msg.attachments.all():
        attachments_data.append({
            'id': str(att.id),
            'original_name': att.original_name,
            'file_size': att.file_size,
            'mime_type': att.mime_type,
            'is_image': att.is_image,
            'file_url': att.file.url if att.file else None,
        })

    receipts_data = []
    for r in msg.receipts.all():
        receipts_data.append({
            'id': str(r.id),
            'user_id': str(r.user_id),
            'status': r.status,
            'timestamp': r.timestamp.isoformat(),
        })

    overall_status = 'sent'
    if any(r['status'] == 'read' for r in receipts_data):
        overall_status = 'read'
    elif any(r['status'] == 'delivered' for r in receipts_data):
        overall_status = 'delivered'

    return {
        'id': str(msg.id),
        'conversation': str(msg.conversation_id),
        'sender': {
            'id': str(msg.sender.id),
            'username': msg.sender.username,
            'display_name': msg.sender.display_name or msg.sender.username,
            'profile_picture_url': msg.sender.profile_picture.url if msg.sender.profile_picture else None,
        },
        'text': msg.text,
        'message_type': msg.message_type,
        'idempotency_key': msg.idempotency_key,
        'is_edited': msg.is_edited,
        'is_deleted': msg.is_deleted,
        'created_at': msg.created_at.isoformat(),
        'updated_at': msg.updated_at.isoformat(),
        'receipts': receipts_data,
        'attachments': attachments_data,
        'overall_status': overall_status,
    }

@database_sync_to_async
def mark_delivered(user, message_id):
    msg = Message.objects.filter(id=message_id).first()
    if not msg:
        return None
    MessageReceipt.objects.update_or_create(
        message=msg,
        user=user,
        defaults={'status': 'delivered', 'timestamp': timezone.now()}
    )
    return {
        'message_id': str(msg.id),
        'conversation_id': str(msg.conversation_id),
        'user_id': str(user.id),
        'status': 'delivered',
        'timestamp': timezone.now().isoformat()
    }

@database_sync_to_async
def mark_read(user, message_id, conversation_id=None):
    now = timezone.now()
    if message_id:
        msg = Message.objects.filter(id=message_id).first()
        if not msg:
            return None
        conv_id = msg.conversation_id
        MessageReceipt.objects.update_or_create(
            message=msg,
            user=user,
            defaults={'status': 'read', 'timestamp': now}
        )
        MessageReceipt.objects.filter(
            message__conversation_id=conv_id,
            user=user,
            message__created_at__lte=msg.created_at
        ).exclude(status='read').update(status='read', timestamp=now)
    elif conversation_id:
        conv_id = conversation_id
        MessageReceipt.objects.filter(
            message__conversation_id=conv_id,
            user=user
        ).exclude(status='read').update(status='read', timestamp=now)
    else:
        return None

    ConversationMember.objects.filter(
        conversation_id=conv_id,
        user=user
    ).update(last_read_at=now)

    return {
        'message_id': str(message_id) if message_id else None,
        'conversation_id': str(conv_id),
        'user_id': str(user.id),
        'status': 'read',
        'timestamp': now.isoformat()
    }


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_group = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_group, self.channel_name)

        await self.accept()

        self.joined_conversations = set()
        conv_ids = await get_user_conversations(self.user)
        for cid in conv_ids:
            group_name = f"conversation_{cid}"
            await self.channel_layer.group_add(group_name, self.channel_name)
            self.joined_conversations.add(str(cid))

        just_came_online = await user_connected(self.user.id)
        if just_came_online:
            presence_data = {
                'type': 'chat_presence_update',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'is_online': True,
                'last_seen': None,
            }
            for cid in self.joined_conversations:
                await self.channel_layer.group_send(f"conversation_{cid}", presence_data)

    async def disconnect(self, close_code):
        if hasattr(self, 'user') and self.user.is_authenticated:
            await self.channel_layer.group_discard(self.user_group, self.channel_name)

            if hasattr(self, 'joined_conversations'):
                for cid in self.joined_conversations:
                    await self.channel_layer.group_discard(f"conversation_{cid}", self.channel_name)

            just_went_offline, last_seen = await user_disconnected(self.user.id)
            if just_went_offline and hasattr(self, 'joined_conversations'):
                presence_data = {
                    'type': 'chat_presence_update',
                    'user_id': str(self.user.id),
                    'username': self.user.username,
                    'is_online': False,
                    'last_seen': last_seen,
                }
                for cid in self.joined_conversations:
                    await self.channel_layer.group_send(f"conversation_{cid}", presence_data)

    async def receive_json(self, content):
        event_type = content.get('type')
        if not event_type:
            return

        if event_type == 'conversation.join':
            cid = content.get('conversation_id')
            if cid:
                is_member = await check_user_in_conversation(self.user, cid)
                if is_member:
                    group_name = f"conversation_{cid}"
                    await self.channel_layer.group_add(group_name, self.channel_name)
                    if hasattr(self, 'joined_conversations'):
                        self.joined_conversations.add(str(cid))

        elif event_type == 'message.send':
            cid = content.get('conversation_id')
            text = content.get('text', '')
            idempotency_key = content.get('idempotency_key')
            message_type = content.get('message_type', 'text')
            attachment_ids = content.get('attachment_ids', [])

            if not cid:
                await self.send_json({'type': 'error', 'message': 'Missing conversation_id.'})
                return

            is_member = await check_user_in_conversation(self.user, cid)
            if not is_member:
                await self.send_json({'type': 'error', 'message': 'Not a member of this conversation.'})
                return

            msg_payload, is_new = await save_message_and_receipts(
                user=self.user,
                conversation_id=cid,
                text=text,
                idempotency_key=idempotency_key,
                message_type=message_type,
                attachment_ids=attachment_ids
            )

            if msg_payload:
                group_name = f"conversation_{cid}"
                if str(cid) not in self.joined_conversations:
                    await self.channel_layer.group_add(group_name, self.channel_name)
                    self.joined_conversations.add(str(cid))

                await self.channel_layer.group_send(
                    group_name,
                    {
                        'type': 'chat_message_new',
                        'message': msg_payload,
                    }
                )

        elif event_type == 'message.delivered':
            mid = content.get('message_id')
            cid = content.get('conversation_id')
            if mid and cid:
                receipt = await mark_delivered(self.user, mid)
                if receipt:
                    await self.channel_layer.group_send(
                        f"conversation_{cid}",
                        {
                            'type': 'chat_message_delivered',
                            'receipt': receipt,
                        }
                    )

        elif event_type == 'message.read':
            mid = content.get('message_id')
            cid = content.get('conversation_id')
            if cid:
                receipt = await mark_read(self.user, mid, cid)
                if receipt:
                    await self.channel_layer.group_send(
                        f"conversation_{cid}",
                        {
                            'type': 'chat_message_read',
                            'receipt': receipt,
                        }
                    )

        elif event_type == 'typing.start':
            cid = content.get('conversation_id')
            if cid:
                is_member = await check_user_in_conversation(self.user, cid)
                if is_member:
                    await self.channel_layer.group_send(
                        f"conversation_{cid}",
                        {
                            'type': 'chat_typing_update',
                            'conversation_id': str(cid),
                            'user_id': str(self.user.id),
                            'username': self.user.username,
                            'is_typing': True,
                        }
                    )

        elif event_type == 'typing.stop':
            cid = content.get('conversation_id')
            if cid:
                is_member = await check_user_in_conversation(self.user, cid)
                if is_member:
                    await self.channel_layer.group_send(
                        f"conversation_{cid}",
                        {
                            'type': 'chat_typing_update',
                            'conversation_id': str(cid),
                            'user_id': str(self.user.id),
                            'username': self.user.username,
                            'is_typing': False,
                        }
                    )

    async def chat_message_new(self, event):
        await self.send_json({
            'type': 'message.new',
            'message': event['message'],
        })

    async def chat_message_updated(self, event):
        await self.send_json({
            'type': 'message.updated',
            'message': event['message'],
        })

    async def chat_message_deleted(self, event):
        await self.send_json({
            'type': 'message.deleted',
            'message_id': event['message_id'],
            'conversation_id': event['conversation_id'],
        })

    async def chat_message_delivered(self, event):
        await self.send_json({
            'type': 'message.delivered',
            'receipt': event['receipt'],
        })

    async def chat_message_read(self, event):
        await self.send_json({
            'type': 'message.read',
            'receipt': event['receipt'],
        })

    async def chat_typing_update(self, event):
        if event.get('user_id') != str(self.user.id):
            await self.send_json({
                'type': 'typing.update',
                'conversation_id': event['conversation_id'],
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing'],
            })

    async def chat_presence_update(self, event):
        if event.get('user_id') != str(self.user.id):
            await self.send_json({
                'type': 'presence.update',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_online': event['is_online'],
                'last_seen': event.get('last_seen'),
            })
