from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import Conversation, ConversationMember
from .serializers import (
    ConversationListSerializer,
    CreateConversationSerializer,
    ConversationMemberSerializer,
    AddMemberSerializer,
)

User = get_user_model()

class ConversationListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        conversations = Conversation.objects.filter(
            memberships__user=user
        ).prefetch_related(
            'memberships__user',
            'messages',
            'messages__sender'
        ).distinct().order_by('-updated_at')

        serializer = ConversationListSerializer(
            conversations,
            many=True,
            context={'request': request}
        )
        return Response(serializer.data)

    def post(self, request):
        serializer = CreateConversationSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        conv_type = data.get('type', 'direct')

        if conv_type == 'direct':
            recipient_id = data['recipient_id']
            # Check for existing direct conversation between request.user and recipient
            existing_conv = Conversation.objects.filter(
                type='direct',
                memberships__user=request.user
            ).filter(
                memberships__user_id=recipient_id
            ).first()

            if existing_conv:
                out_serializer = ConversationListSerializer(
                    existing_conv,
                    context={'request': request}
                )
                return Response(out_serializer.data, status=status.HTTP_200_OK)

            recipient = get_object_or_404(User, id=recipient_id)

            with transaction.atomic():
                conversation = Conversation.objects.create(
                    type='direct',
                    created_by=request.user
                )
                ConversationMember.objects.create(
                    conversation=conversation,
                    user=request.user,
                    role='member'
                )
                ConversationMember.objects.create(
                    conversation=conversation,
                    user=recipient,
                    role='member'
                )

            out_serializer = ConversationListSerializer(
                conversation,
                context={'request': request}
            )
            return Response(out_serializer.data, status=status.HTTP_201_CREATED)

        elif conv_type == 'group':
            name = data['name']
            member_ids = data.get('member_ids', [])

            with transaction.atomic():
                conversation = Conversation.objects.create(
                    type='group',
                    name=name,
                    created_by=request.user
                )
                # Add creator as admin
                ConversationMember.objects.create(
                    conversation=conversation,
                    user=request.user,
                    role='admin'
                )
                # Add other members
                for uid in member_ids:
                    if str(uid) != str(request.user.id):
                        u = User.objects.filter(id=uid).first()
                        if u:
                            ConversationMember.objects.create(
                                conversation=conversation,
                                user=u,
                                role='member'
                            )

            out_serializer = ConversationListSerializer(
                conversation,
                context={'request': request}
            )
            return Response(out_serializer.data, status=status.HTTP_201_CREATED)


class ConversationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_conversation(self, pk, user):
        return get_object_or_404(
            Conversation.objects.filter(memberships__user=user),
            pk=pk
        )

    def get(self, request, pk):
        conversation = self.get_conversation(pk, request.user)
        serializer = ConversationListSerializer(conversation, context={'request': request})
        return Response(serializer.data)

    def patch(self, request, pk):
        conversation = self.get_conversation(pk, request.user)
        if conversation.type == 'group':
            # Check admin permission
            membership = conversation.memberships.filter(user=request.user).first()
            if not membership or membership.role != 'admin':
                return Response(
                    {'detail': 'Only group admins can update group settings.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        name = request.data.get('name')
        if name:
            conversation.name = name

        if 'avatar' in request.FILES:
            conversation.avatar = request.FILES['avatar']

        conversation.save()
        serializer = ConversationListSerializer(conversation, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, pk):
        conversation = self.get_conversation(pk, request.user)
        # Remove requesting user membership
        membership = conversation.memberships.filter(user=request.user).first()
        if membership:
            membership.delete()

        # If direct conversation or group with no remaining members, clean up
        if conversation.memberships.count() == 0:
            conversation.delete()

        return Response({'message': 'Removed from conversation.'}, status=status.HTTP_200_OK)


class ConversationMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        conversation = get_object_or_404(
            Conversation.objects.filter(memberships__user=request.user),
            pk=pk
        )
        memberships = conversation.memberships.all().select_related('user')
        serializer = ConversationMemberSerializer(memberships, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, pk):
        conversation = get_object_or_404(
            Conversation.objects.filter(memberships__user=request.user),
            pk=pk
        )
        if conversation.type != 'group':
            return Response(
                {'detail': 'Cannot add members to a direct chat.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        membership = conversation.memberships.filter(user=request.user).first()
        if not membership or membership.role != 'admin':
            return Response(
                {'detail': 'Only group admins can add members.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = AddMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_ids = serializer.validated_data['user_ids']

        added_users = []
        for uid in user_ids:
            if not conversation.memberships.filter(user_id=uid).exists():
                u = User.objects.get(id=uid)
                ConversationMember.objects.create(
                    conversation=conversation,
                    user=u,
                    role='member'
                )
                added_users.append(u.username)

        # Update conversation timestamp
        conversation.save(update_fields=['updated_at'])

        return Response({
            'message': f"Added members: {', '.join(added_users)}",
            'added_count': len(added_users)
        }, status=status.HTTP_201_CREATED)


class ConversationMemberDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk, user_id):
        conversation = get_object_or_404(
            Conversation.objects.filter(memberships__user=request.user),
            pk=pk
        )
        if conversation.type != 'group':
            return Response(
                {'detail': 'Member operations only apply to groups.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        current_membership = conversation.memberships.filter(user=request.user).first()
        target_membership = get_object_or_404(conversation.memberships, user_id=user_id)

        # Allow if user is removing themselves OR if current user is admin
        is_self = str(request.user.id) == str(user_id)
        is_admin = current_membership and current_membership.role == 'admin'

        if not (is_self or is_admin):
            return Response(
                {'detail': 'Only group admins can remove other members.'},
                status=status.HTTP_403_FORBIDDEN
            )

        target_membership.delete()
        conversation.save(update_fields=['updated_at'])

        return Response({'message': 'Member removed.'}, status=status.HTTP_200_OK)
