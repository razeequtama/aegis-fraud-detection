import redis
import os

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

def check_transaction_velocity(account_id: str, window_seconds: int = 60) -> int:
    """
    Menghitung atau menambah counter transaksi cepat berdasarkan account_id dalam window waktu tertentu.
    """
    key = f"velocity:account:{account_id}"
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, window_seconds)
    result = pipe.execute()
    return result[0]