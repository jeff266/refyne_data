"""Dependency injection for FastAPI routes.

Provides provider instances with appropriate API keys loaded from either
the encrypted key store or environment variables.
"""

import os
from typing import Optional

from fastapi import HTTPException, status

from api.services import key_manager

# Import provider modules for dynamic key injection
import sys
from pathlib import Path

# Add parent directory to path so we can import providers
sys.path.insert(0, str(Path(__file__).parent.parent))

from providers import serper, apollo, zoominfo, clay, graphiq
from config_loader import get_provider


class ProviderKeyError(Exception):
    """Raised when a provider's API key is not configured."""
    pass


def _get_effective_key(provider: str, env_key: str) -> Optional[str]:
    """Get the effective API key for a provider.

    Priority:
    1. Stored key (from key_manager)
    2. Environment variable

    Args:
        provider: Provider identifier (e.g., 'apollo')
        env_key: Environment variable name (e.g., 'APOLLO_API_KEY')

    Returns:
        The API key, or None if not configured.
    """
    # First check stored keys
    stored_key = key_manager.get_key(provider)
    if stored_key:
        return stored_key

    # Fall back to environment variable
    env_value = os.getenv(env_key)
    if env_value and not env_value.startswith("your_"):
        return env_value

    return None


def get_serper_key() -> str:
    """Get the Serper API key or raise an error."""
    key = _get_effective_key("serper", "SERPER_API_KEY")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serper API key not configured. Please add your API key in Settings.",
        )
    return key


def get_apollo_key() -> str:
    """Get the Apollo API key or raise an error."""
    key = _get_effective_key("apollo", "APOLLO_API_KEY")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Apollo API key not configured. Please add your API key in Settings.",
        )
    return key


def get_zoominfo_credentials() -> tuple[str, str]:
    """Get ZoomInfo client ID and secret or raise an error."""
    client_id = _get_effective_key("zoominfo_client_id", "ZOOMINFO_CLIENT_ID")
    client_secret = _get_effective_key("zoominfo_client_secret", "ZOOMINFO_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ZoomInfo credentials not configured. Please add your API keys in Settings.",
        )
    return client_id, client_secret


def get_graphiq_key() -> str:
    """Get the GraphIQ API key or raise an error."""
    key = _get_effective_key("graphiq", "GRAPHIQ_API_KEY")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GraphIQ API key not configured. Please add your API key in Settings.",
        )
    return key


def get_clay_key() -> str:
    """Get the Clay API key or raise an error."""
    key = _get_effective_key("clay", "CLAY_API_KEY")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clay API key not configured. Please add your API key in Settings.",
        )
    return key


def is_provider_available(provider: str) -> bool:
    """Check if a provider has its required credentials configured.

    Args:
        provider: Provider identifier

    Returns:
        True if all required credentials are available.
    """
    try:
        if provider == "serper":
            return bool(_get_effective_key("serper", "SERPER_API_KEY"))
        elif provider == "apollo":
            return bool(_get_effective_key("apollo", "APOLLO_API_KEY"))
        elif provider == "zoominfo":
            client_id = _get_effective_key("zoominfo_client_id", "ZOOMINFO_CLIENT_ID")
            client_secret = _get_effective_key("zoominfo_client_secret", "ZOOMINFO_CLIENT_SECRET")
            return bool(client_id and client_secret)
        elif provider == "graphiq":
            return bool(_get_effective_key("graphiq", "GRAPHIQ_API_KEY"))
        elif provider == "clay":
            return bool(_get_effective_key("clay", "CLAY_API_KEY"))
        else:
            return False
    except Exception:
        return False


def inject_provider_keys():
    """Inject stored keys into provider modules for API calls.

    This temporarily overrides the module-level API key variables
    with keys from the key manager if available.
    """
    # Serper
    serper_key = _get_effective_key("serper", "SERPER_API_KEY")
    if serper_key:
        serper.SERPER_API_KEY = serper_key

    # Apollo
    apollo_key = _get_effective_key("apollo", "APOLLO_API_KEY")
    if apollo_key:
        apollo.APOLLO_API_KEY = apollo_key

    # ZoomInfo
    zi_client_id = _get_effective_key("zoominfo_client_id", "ZOOMINFO_CLIENT_ID")
    zi_client_secret = _get_effective_key("zoominfo_client_secret", "ZOOMINFO_CLIENT_SECRET")
    if zi_client_id:
        zoominfo.ZOOMINFO_CLIENT_ID = zi_client_id
    if zi_client_secret:
        zoominfo.ZOOMINFO_CLIENT_SECRET = zi_client_secret

    # GraphIQ
    graphiq_key = _get_effective_key("graphiq", "GRAPHIQ_API_KEY")
    if graphiq_key:
        graphiq.GRAPHIQ_API_KEY = graphiq_key

    # Clay
    clay_key = _get_effective_key("clay", "CLAY_API_KEY")
    if clay_key:
        clay.CLAY_API_KEY = clay_key
