from rest_framework import serializers
from .models import Attachment
from accounts.serializers import UserSerializer

class AttachmentSerializer(serializers.ModelSerializer):
    uploader = UserSerializer(read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = [
            'id',
            'conversation',
            'message',
            'uploader',
            'file',
            'file_url',
            'original_name',
            'file_size',
            'mime_type',
            'is_image',
            'created_at',
        ]
        read_only_fields = ['id', 'uploader', 'original_name', 'file_size', 'mime_type', 'is_image', 'created_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file:
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
