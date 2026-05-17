import hashlib
import hmac
import secrets


def generate_api_key() -> str:
    return "ek_" + secrets.token_urlsafe(32)


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def api_key_hashes_match(stored_hash: str, candidate_key: str) -> bool:
    return hmac.compare_digest(stored_hash, hash_api_key(candidate_key))
