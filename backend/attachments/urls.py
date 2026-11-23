from django.urls import path
from .views import AttachmentUploadView

urlpatterns = [
    path('attachments/upload/', AttachmentUploadView.as_view(), name='attachment_upload'),
]
