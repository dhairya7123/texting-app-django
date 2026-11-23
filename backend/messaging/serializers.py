from rest_framework import serializers
from .models import Message, MessageReceipt
from accounts.serializers import UserSerializer
from attachments.models import Attachment

class MessageReceiptSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = MessageReceipt
        fields = ['id', 'user_id', 'username', 'status', 'timestamp']


class SimpleAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ['id', 'original_name', 'file_size', 'mime_type', 'is_image', 'file_url']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file:
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    receipts = MessageReceiptSerializer(many=True, read_only=True)
    attachments = SimpleAttachmentSerializer(many=True, read_only=True)
    overall_status = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id',
            'conversation',
            'sender',
            'text',
            'message_type',
            'idempotency_key',
            'is_edited',
            'is_deleted',
            'created_at',
            'updated_at',
            'receipts',
            'attachments',
            'overall_status',
        ]
        read_only_fields = ['id', 'sender', 'is_edited', 'is_deleted', 'created_at', 'updated_at']

    def get_overall_status(self, obj):
        receipts = obj.receipts.all()
        if not receipts:
            return 'sent'
        if any(r.status == 'read' for r in receipts):
            return 'read'
        if any(r.status == 'delivered' for r in receipts):
            return 'delivered'
        return 'sent'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_deleted:
            data['text'] = "This message was deleted"
            data['attachments'] = []
        return data


class CreateMessageSerializer(serializers.Serializer):
    text = serializers.CharField(required=False, allow_blank=True, default='')
    idempotency_key = serializers.CharField(max_length=64, required=False, allow_null=True)
    message_type = serializers.ChoiceField(choices=['text', 'attachment', 'system'], default='text')

    def validate(self, attrs):
        text = attrs.get('text', '').strip()
        message_type = attrs.get('message_type')
        if message_type == 'text' and not text:
            raise serializers.ValidationError({"text": "Message text cannot be empty."})
        return attrs
