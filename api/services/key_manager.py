"""Key Manager service for BYOK (Bring Your Own Key) functionality.

Stores API keys in a local encrypted JSON file using Fernet symmetric encryption.
"""

import json
import os
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

# Path to the encrypted keys file
KEYS_FILE = Path(__file__).parent.parent.parent / ".keys.encrypted"
MASTER_KEY_FILE = Path(__file__).parent.parent.parent / ".master.key"


def _get_or_create_master_key() -> bytes:
    """Get or create the master encryption key.

    In production, this should be stored in a secure secrets manager.
    For local development, we store it in a file that should be gitignored.
    """
    if MASTER_KEY_FILE.exists():
        return MASTER_KEY_FILE.read_bytes()

    # Generate a new key
    key = Fernet.generate_key()
    MASTER_KEY_FILE.write_bytes(key)
    # Set restrictive permissions (owner read/write only)
    os.chmod(MASTER_KEY_FILE, 0o600)
    return key


def _get_fernet() -> Fernet:
    """Get a Fernet instance for encryption/decryption."""
    return Fernet(_get_or_create_master_key())


def _load_keys() -> dict:
    """Load all encrypted keys from storage."""
    if not KEYS_FILE.exists():
        return {}

    try:
        fernet = _get_fernet()
        encrypted_data = KEYS_FILE.read_bytes()
        decrypted_data = fernet.decrypt(encrypted_data)
        return json.loads(decrypted_data.decode())
    except (InvalidToken, json.JSONDecodeError):
        # If decryption fails, return empty dict (keys file may be corrupted)
        return {}


def _save_keys(keys: dict) -> None:
    """Save all keys to encrypted storage."""
    fernet = _get_fernet()
    data = json.dumps(keys).encode()
    encrypted_data = fernet.encrypt(data)
    KEYS_FILE.write_bytes(encrypted_data)
    # Set restrictive permissions
    os.chmod(KEYS_FILE, 0o600)


def get_key(provider: str) -> Optional[str]:
    """Get an API key for a provider.

    Args:
        provider: Provider identifier (e.g., 'apollo', 'serper')

    Returns:
        The API key string, or None if not set.
    """
    keys = _load_keys()
    return keys.get(provider)


def save_key(provider: str, key: str) -> bool:
    """Save an API key for a provider.

    Args:
        provider: Provider identifier (e.g., 'apollo', 'serper')
        key: The API key to store

    Returns:
        True if save was successful.
    """
    keys = _load_keys()
    keys[provider] = key
    _save_keys(keys)
    return True


def delete_key(provider: str) -> bool:
    """Delete an API key for a provider.

    Args:
        provider: Provider identifier (e.g., 'apollo', 'serper')

    Returns:
        True if key was deleted, False if key didn't exist.
    """
    keys = _load_keys()
    if provider in keys:
        del keys[provider]
        _save_keys(keys)
        return True
    return False


def has_key(provider: str) -> bool:
    """Check if an API key is configured for a provider.

    Args:
        provider: Provider identifier (e.g., 'apollo', 'serper')

    Returns:
        True if key exists.
    """
    keys = _load_keys()
    return provider in keys and bool(keys[provider])


def list_providers_with_keys() -> list[str]:
    """List all providers that have API keys configured.

    Returns:
        List of provider identifiers that have keys stored.
    """
    keys = _load_keys()
    return list(keys.keys())


def get_provider_status(provider: str) -> dict:
    """Get the status of a provider's key configuration.

    Args:
        provider: Provider identifier

    Returns:
        Dict with 'configured' boolean and 'source' string.
    """
    # First check encrypted storage
    if has_key(provider):
        return {"configured": True, "source": "stored"}

    # Fall back to environment variables
    env_key_map = {
        "serper": "SERPER_API_KEY",
        "apollo": "APOLLO_API_KEY",
        "zoominfo": ["ZOOMINFO_CLIENT_ID", "ZOOMINFO_CLIENT_SECRET"],
        "graphiq": "GRAPHIQ_API_KEY",
        "clay": "CLAY_API_KEY",
    }

    env_keys = env_key_map.get(provider)
    if not env_keys:
        return {"configured": False, "source": None}

    if isinstance(env_keys, list):
        # Multiple keys required (e.g., ZoomInfo)
        all_set = all(_is_env_var_set(k) for k in env_keys)
        return {"configured": all_set, "source": "environment" if all_set else None}
    else:
        # Single key
        is_set = _is_env_var_set(env_keys)
        return {"configured": is_set, "source": "environment" if is_set else None}


def _is_env_var_set(key: str) -> bool:
    """Check if an environment variable is set to a real value."""
    value = os.getenv(key)
    if not value:
        return False
    if value.startswith("your_"):
        return False
    return True
