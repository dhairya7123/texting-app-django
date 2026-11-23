from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Max
from .models import Conversation, ConversationMember
from accounts.serializers import UserSerializer

User = get_user_model()

class ConversationMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = ConversationMember
        fields = ['id', 'user', 'user_id', 'role', 'joined_at', 'last_read_at']
        read_only_fields = ['id', 'joined_at', 'last_read_at']


class ConversationListSerializer(serializers.ModelSerializer):
    members = ConversationMemberSerializer(source='memberships', many=True, read_only=True)
    title = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    other_user = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id',
            'type',
            'name',
            'title',
            'avatar',
            'avatar_url',
            'created_by',
            'created_at',
            'updated_at',
            'members',
            'last_message',
            'unread_count',
            'other_user',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_title(self, obj):
        if obj.type == 'group':
            return obj.name or "Unnamed Group"
        request = self.context.get('request')
        if not request or not request.user:
            return obj.name or "Direct Chat"
        other_membership = obj.memberships.exclude(user=request.user).select_related('user').first()
        if other_membership and other_membership.user:
            return other_membership.user.display_name or other_membership.user.username
        return "Direct Chat"

    def get_other_user(self, obj):
        if obj.type != 'direct':
            return None
        request = self.context.get('request')
        if not request or not request.user:
            return None
        other_membership = obj.memberships.exclude(user=request.user).select_related('user').first()
        if other_membership and other_membership.user:
            return UserSerializer(other_membership.user, context=self.context).data
        return None

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        if obj.type == 'group':
            if obj.avatar:
                if request:
                    return request.build_absolute_uri(obj.avatar.url)
                return obj.avatar.url
            return None
        # For direct chats, return the other user's profile picture
        if request and request.user:
            other_membership = obj.memberships.exclude(user=request.user).select_related('user').first()
            if other_membership and other_membership.user and other_membership.user.profile_picture:
                return request.build_absolute_uri(other_membership.user.profile_picture.url)
        return None

    def get_last_message(self, obj):
        last_msg = obj.messages.filter(is_deleted=False).order_by('-created_at').first()
        if not last_msg:
            return None
        return {
            'id': str(last_msg.id),
            'sender_id': str(last_msg.sender_id),
            'sender_name': last_msg.sender.display_name or last_msg.sender.username,
            'text': last_msg.text,
            'message_type': last_msg.message_type,
            'created_at': last_msg.created_at.isoformat(),
        }

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return 0
        member = obj.memberships.filter(user=request.user).first()
        if not member or not member.last_read_at:
            return obj.messages.exclude(sender=request.user).count()
        return obj.messages.exclude(sender=request.user).filter(created_at__gt=member.last_read_at).count()


class CreateConversationSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=['direct', 'group'], default='direct')
    recipient_id = serializers.UUIDField(required=False, allow_null=True)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    member_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )

    def validate(self, attrs):
        conv_type = attrs.get('type')
        if conv_type == 'direct':
            recipient_id = attrs.get('recipient_id')
            if not recipient_id:
                raise serializers.ValidationError({"recipient_id": "recipient_id is required for direct conversations."})
            request = self.context.get('request')
            if str(recipient_id) == str(request.user.id):
                raise serializers.ValidationError({"recipient_id": "Cannot start a direct conversation with yourself."})
            if not User.objects.filter(id=recipient_id).exists():
                raise serializers.ValidationError({"recipient_id": "Recipient user does not exist."})
        elif conv_type == 'group':
            name = attrs.get('name')
            if not name or not name.strip():
                raise serializers.ValidationError({"name": "Group name is required."})
        return attrs


class AddMemberSerializer(serializers.Serializer):
    user_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)

    def validate_user_ids(self, value):
        existing = User.objects.filter(id__in=value).count()
        if existing != len(value):
            raise serializers.ValidationError("One or more user IDs do not exist.")
        return value
