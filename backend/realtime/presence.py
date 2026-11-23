from django.core.cache import cache
from channels.db import database_sync_to_async
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()

@database_sync_to_async
def user_connected(user_id):
    cache_key = f"user_connections_{user_id}"
    try:
        count = cache.get(cache_key, 0)
        new_count = count + 1
        cache.set(cache_key, new_count, timeout=86400)
    except Exception:
        new_count = 1

    if new_count == 1:
        User.objects.filter(id=user_id).update(is_online=True)
        return True
    return False

@database_sync_to_async
def user_disconnected(user_id):
    cache_key = f"user_connections_{user_id}"
    now = timezone.now()
    try:
        count = cache.get(cache_key, 1)
        new_count = max(0, count - 1)
        cache.set(cache_key, new_count, timeout=86400)
    except Exception:
        new_count = 0

    if new_count == 0:
        User.objects.filter(id=user_id).update(is_online=False, last_seen=now)
        return True, now.isoformat()
    return False, now.isoformat()
