"""Keys router for BYOK (Bring Your Own Key) management."""

from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import requests

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from api.services import key_manager
from config_loader import get_providers

router = APIRouter(prefix="/keys", tags=["keys"])


# Request/Response Models

class ProviderKeyStatus(BaseModel):
    """Status of a provider's API key configuration."""
    provider: str
    name: str
    configured: bool
    source: Optional[str] = None  # 'stored', 'environment', or None


class KeyListResponse(BaseModel):
    """Response listing all providers and their key status."""
    providers: list[ProviderKeyStatus]


class SaveKeyRequest(BaseModel):
    """Request to save an API key."""
    key: str = Field(..., min_length=1, description="The API key to store")
    # For providers with multiple keys (like ZoomInfo)
    secondary_key: Optional[str] = Field(
        None, description="Secondary key (e.g., client secret)"
    )


class SaveKeyResponse(BaseModel):
    """Response after saving a key."""
    provider: str
    success: bool
    message: str


class DeleteKeyResponse(BaseModel):
    """Response after deleting a key."""
    provider: str
    success: bool
    message: str


class TestKeyRequest(BaseModel):
    """Request to test an API key (optional - can test stored key)."""
    key: Optional[str] = Field(
        None, description="Key to test (uses stored key if not provided)"
    )
    secondary_key: Optional[str] = Field(
        None, description="Secondary key for providers that need it"
    )


class TestKeyResponse(BaseModel):
    """Response from testing an API key."""
    provider: str
    valid: bool
    message: str


# Endpoints

@router.get("", response_model=KeyListResponse)
async def list_keys():
    """List all providers and their key configuration status.

    Returns whether each provider has a key configured, but never
    returns the actual key values for security.
    """
    providers_config = get_providers()
    statuses = []

    for provider_id, provider_info in providers_config.items():
        status_info = key_manager.get_provider_status(provider_id)
        statuses.append(
            ProviderKeyStatus(
                provider=provider_id,
                name=provider_info.get("name", provider_id),
                configured=status_info["configured"],
                source=status_info["source"],
            )
        )

    return KeyListResponse(providers=statuses)


@router.post("/{provider}", response_model=SaveKeyResponse)
async def save_key(provider: str, request: SaveKeyRequest):
    """Save an API key for a provider.

    The key is encrypted before being stored locally.
    """
    # Validate provider exists
    providers_config = get_providers()
    if provider not in providers_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown provider: {provider}",
        )

    # Handle providers with multiple keys (e.g., ZoomInfo)
    if provider == "zoominfo":
        if not request.secondary_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ZoomInfo requires both client_id (key) and client_secret (secondary_key)",
            )
        # Store both keys
        key_manager.save_key("zoominfo_client_id", request.key)
        key_manager.save_key("zoominfo_client_secret", request.secondary_key)
    else:
        # Single key provider
        key_manager.save_key(provider, request.key)

    return SaveKeyResponse(
        provider=provider,
        success=True,
        message=f"API key for {provider} saved successfully",
    )


@router.delete("/{provider}", response_model=DeleteKeyResponse)
async def delete_key(provider: str):
    """Remove a stored API key for a provider.

    This does not affect environment variables, only stored keys.
    """
    # Validate provider exists
    providers_config = get_providers()
    if provider not in providers_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown provider: {provider}",
        )

    # Handle providers with multiple keys
    if provider == "zoominfo":
        deleted_id = key_manager.delete_key("zoominfo_client_id")
        deleted_secret = key_manager.delete_key("zoominfo_client_secret")
        deleted = deleted_id or deleted_secret
    else:
        deleted = key_manager.delete_key(provider)

    if deleted:
        return DeleteKeyResponse(
            provider=provider,
            success=True,
            message=f"API key for {provider} deleted",
        )
    else:
        return DeleteKeyResponse(
            provider=provider,
            success=False,
            message=f"No stored key found for {provider}",
        )


@router.post("/{provider}/test", response_model=TestKeyResponse)
async def test_key(provider: str, request: Optional[TestKeyRequest] = None):
    """Test if an API key is valid by making a simple API call.

    Can test either:
    - A provided key (for validating before saving)
    - The currently stored/configured key
    """
    # Validate provider exists
    providers_config = get_providers()
    if provider not in providers_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown provider: {provider}",
        )

    # Get the key to test
    if request and request.key:
        test_key = request.key
        test_secondary = request.secondary_key
    else:
        # Use stored key
        if provider == "zoominfo":
            test_key = key_manager.get_key("zoominfo_client_id")
            test_secondary = key_manager.get_key("zoominfo_client_secret")
        else:
            test_key = key_manager.get_key(provider)
            test_secondary = None

    if not test_key:
        return TestKeyResponse(
            provider=provider,
            valid=False,
            message="No API key configured or provided",
        )

    # Test the key with a simple API call
    try:
        if provider == "serper":
            valid, message = _test_serper_key(test_key)
        elif provider == "apollo":
            valid, message = _test_apollo_key(test_key)
        elif provider == "zoominfo":
            if not test_secondary:
                return TestKeyResponse(
                    provider=provider,
                    valid=False,
                    message="ZoomInfo requires both client_id and client_secret",
                )
            valid, message = _test_zoominfo_key(test_key, test_secondary)
        elif provider == "graphiq":
            valid, message = _test_graphiq_key(test_key)
        elif provider == "clay":
            valid, message = _test_clay_key(test_key)
        else:
            return TestKeyResponse(
                provider=provider,
                valid=False,
                message=f"Key testing not implemented for {provider}",
            )

        return TestKeyResponse(
            provider=provider,
            valid=valid,
            message=message,
        )

    except Exception as e:
        return TestKeyResponse(
            provider=provider,
            valid=False,
            message=f"Error testing key: {str(e)}",
        )


# Key testing helper functions

def _test_serper_key(api_key: str) -> tuple[bool, str]:
    """Test a Serper API key."""
    try:
        response = requests.post(
            "https://google.serper.dev/search",
            headers={
                "X-API-KEY": api_key,
                "Content-Type": "application/json",
            },
            json={"q": "test", "num": 1},
            timeout=10,
        )

        if response.status_code == 200:
            return True, "Serper API key is valid"
        elif response.status_code == 401:
            return False, "Invalid API key"
        elif response.status_code == 403:
            return False, "API key does not have permission"
        else:
            return False, f"Unexpected response: {response.status_code}"

    except requests.Timeout:
        return False, "Request timed out"
    except requests.RequestException as e:
        return False, f"Connection error: {str(e)}"


def _test_apollo_key(api_key: str) -> tuple[bool, str]:
    """Test an Apollo API key."""
    try:
        response = requests.post(
            "https://api.apollo.io/v1/auth/health",
            json={"api_key": api_key},
            timeout=10,
        )

        if response.status_code == 200:
            return True, "Apollo API key is valid"
        elif response.status_code == 401:
            return False, "Invalid API key"
        else:
            # Apollo returns 200 even for invalid keys sometimes
            # Try a simple org search to verify
            test_response = requests.post(
                "https://api.apollo.io/v1/organizations/enrich",
                json={"api_key": api_key, "domain": "apollo.io"},
                timeout=10,
            )
            if test_response.status_code == 200:
                return True, "Apollo API key is valid"
            return False, f"API key verification failed: {test_response.status_code}"

    except requests.Timeout:
        return False, "Request timed out"
    except requests.RequestException as e:
        return False, f"Connection error: {str(e)}"


def _test_zoominfo_key(client_id: str, client_secret: str) -> tuple[bool, str]:
    """Test ZoomInfo credentials."""
    try:
        response = requests.post(
            "https://api.zoominfo.com/authenticate",
            json={
                "username": client_id,
                "password": client_secret,
            },
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            if data.get("jwt"):
                return True, "ZoomInfo credentials are valid"
            return False, "Authentication succeeded but no token received"
        elif response.status_code == 401:
            return False, "Invalid credentials"
        else:
            return False, f"Authentication failed: {response.status_code}"

    except requests.Timeout:
        return False, "Request timed out"
    except requests.RequestException as e:
        return False, f"Connection error: {str(e)}"


def _test_graphiq_key(api_key: str) -> tuple[bool, str]:
    """Test a GraphIQ API key."""
    try:
        response = requests.post(
            "https://app.graphiq.ai/api/v2/organizations/search",
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json",
            },
            json={"organization": {"query": "test"}, "limit": 1},
            timeout=10,
        )

        if response.status_code == 200:
            return True, "GraphIQ API key is valid"
        elif response.status_code == 401:
            return False, "Invalid API key"
        elif response.status_code == 403:
            return False, "API key does not have permission"
        else:
            return False, f"Unexpected response: {response.status_code}"

    except requests.Timeout:
        return False, "Request timed out"
    except requests.RequestException as e:
        return False, f"Connection error: {str(e)}"


def _test_clay_key(api_key: str) -> tuple[bool, str]:
    """Test a Clay API key.

    Note: Clay's API testing is limited without a specific webhook URL.
    This performs a basic validation.
    """
    # Clay doesn't have a dedicated auth test endpoint
    # We'll return a generic success if the key format looks valid
    if api_key and len(api_key) > 10:
        return True, "Clay API key format looks valid (full validation requires webhook test)"
    return False, "API key appears to be invalid"
