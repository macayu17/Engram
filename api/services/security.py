import hashlib
import hmac
import secrets


def generate_api_key() -> str:
    return "ek_" + secrets.token_urlsafe(32)


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def api_key_hashes_match(stored_hash: str, candidate_key: str) -> bool:
    return hmac.compare_digest(stored_hash, hash_api_key(candidate_key))

from typing import Final

from cryptography.fernet import Fernet, InvalidToken

from api.config import settings


_PROVIDER_KEY_ENCRYPTION_ENV: Final[str] = "ENGRAM_PROVIDER_KEY_ENCRYPTION_KEY"
_ENCRYPTED_BLOB_VERSION: Final[bytes] = b"v1"


def _resolve_master_fernet() -> Fernet:
    raw_key = settings.provider_key_encryption_key.strip()
    if not raw_key:
        raise RuntimeError(
            f"{_PROVIDER_KEY_ENCRYPTION_ENV} is required to read or write per-user provider API keys",
        )
    try:
        return Fernet(raw_key.encode("ascii"))
    except (ValueError, TypeError) as error:
        raise RuntimeError(
            f"{_PROVIDER_KEY_ENCRYPTION_ENV} is not a valid Fernet key",
        ) from error


def encrypt_provider_key(plaintext: str) -> bytes:
    if plaintext is None:
        raise ValueError("Provider key must not be None")
    fernet = _resolve_master_fernet()
    return _ENCRYPTED_BLOB_VERSION + fernet.encrypt(plaintext.encode("utf-8"))


def decrypt_provider_key(ciphertext: bytes | None) -> str | None:
    if ciphertext is None:
        return None
    if not isinstance(ciphertext, (bytes, bytearray, memoryview)):
        raise ValueError("Encrypted provider key must be bytes")
    if not ciphertext.startswith(_ENCRYPTED_BLOB_VERSION):
        raise ValueError("Encrypted provider key has an unsupported format")
    fernet = _resolve_master_fernet()
    try:
        decrypted = fernet.decrypt(bytes(ciphertext[len(_ENCRYPTED_BLOB_VERSION):]))
    except InvalidToken as error:
        raise ValueError("Encrypted provider key could not be decrypted") from error
    return decrypted.decode("utf-8")


def mask_provider_key(plaintext: str | None) -> str | None:
    if plaintext is None:
        return None
    if not plaintext:
        return ""
    if len(plaintext) <= 8:
        return "*" * len(plaintext)
    return f"{plaintext[:4]}{'*' * (min(len(plaintext), 24) - 8)}{plaintext[-4:]}"


from typing import Final

from cryptography.fernet import Fernet, InvalidToken

from api.config import settings


_PROVIDER_KEY_ENCRYPTION_ENV: Final[str] = "ENGRAM_PROVIDER_KEY_ENCRYPTION_KEY"
_ENCRYPTED_BLOB_VERSION: Final[bytes] = b"v1"


def _resolve_master_fernet() -> Fernet:
    raw_key = settings.provider_key_encryption_key.strip()
    if not raw_key:
        raise RuntimeError(
            f"{_PROVIDER_KEY_ENCRYPTION_ENV} is required to read or write per-user provider API keys",
        )
    try:
        return Fernet(raw_key.encode("ascii"))
    except (ValueError, TypeError) as error:
        raise RuntimeError(
            f"{_PROVIDER_KEY_ENCRYPTION_ENV} is not a valid Fernet key",
        ) from error


def encrypt_provider_key(plaintext: str) -> bytes:
    if plaintext is None:
        raise ValueError("Provider key must not be None")
    fernet = _resolve_master_fernet()
    return _ENCRYPTED_BLOB_VERSION + fernet.encrypt(plaintext.encode("utf-8"))


def decrypt_provider_key(ciphertext: bytes | None) -> str | None:
    if ciphertext is None:
        return None
    if not isinstance(ciphertext, (bytes, bytearray, memoryview)):
        raise ValueError("Encrypted provider key must be bytes")
    if not ciphertext.startswith(_ENCRYPTED_BLOB_VERSION):
        raise ValueError("Encrypted provider key has an unsupported format")
    fernet = _resolve_master_fernet()
    try:
        decrypted = fernet.decrypt(bytes(ciphertext[len(_ENCRYPTED_BLOB_VERSION):]))
    except InvalidToken as error:
        raise ValueError("Encrypted provider key could not be decrypted") from error
    return decrypted.decode("utf-8")


def mask_provider_key(plaintext: str | None) -> str | None:
    if plaintext is None:
        return None
    if not plaintext:
        return ""
    if len(plaintext) <= 8:
        return "*" * len(plaintext)
    return f"{plaintext[:4]}{'*' * (min(len(plaintext), 24) - 8)}{plaintext[-4:]}"