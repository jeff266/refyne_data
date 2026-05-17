"""Configuration loader for the Enrichment Switcher.

Loads segment and provider configuration from config/segments.json with
automatic caching and reload on file modification.
"""

import json
import os
from pathlib import Path
from typing import Optional

# Path to the configuration file
CONFIG_FILE = Path(__file__).parent / "config" / "segments.json"

# Cache for loaded configuration
_config_cache: Optional[dict] = None
_config_mtime: Optional[float] = None


def _load_config() -> dict:
    """Load configuration from JSON file, using cache if file unchanged."""
    global _config_cache, _config_mtime

    # Check file modification time
    try:
        current_mtime = CONFIG_FILE.stat().st_mtime
    except OSError:
        current_mtime = None

    # Return cached config if file hasn't changed
    if _config_cache is not None and _config_mtime == current_mtime:
        return _config_cache

    # Load and parse config file
    with open(CONFIG_FILE, "r") as f:
        _config_cache = json.load(f)
    _config_mtime = current_mtime

    return _config_cache


def get_segments() -> list[dict]:
    """Return visible segments sorted by display order.

    Returns:
        List of segment configuration dictionaries, sorted by 'order' field,
        filtered to only include segments where visible=True.
    """
    config = _load_config()
    segments = config.get("segments", [])

    # Filter to visible segments and sort by order
    visible_segments = [s for s in segments if s.get("visible", True)]
    return sorted(visible_segments, key=lambda s: s.get("order", 999))


def get_segment(segment_id: str) -> Optional[dict]:
    """Return configuration for a single segment by ID.

    Args:
        segment_id: The unique identifier for the segment (e.g., 'smb_local')

    Returns:
        Segment configuration dictionary, or None if not found.
    """
    config = _load_config()
    segments = config.get("segments", [])

    for segment in segments:
        if segment.get("id") == segment_id:
            return segment

    return None


def get_providers() -> dict:
    """Return all provider configurations.

    Returns:
        Dictionary mapping provider IDs to their configuration,
        e.g., {'serper': {'name': 'Serper', 'type': 'local_search', ...}}
    """
    config = _load_config()
    return config.get("providers", {})


def get_provider(provider_id: str) -> Optional[dict]:
    """Return configuration for a single provider by ID.

    Args:
        provider_id: The unique identifier for the provider (e.g., 'apollo')

    Returns:
        Provider configuration dictionary, or None if not found.
    """
    providers = get_providers()
    return providers.get(provider_id)


def is_provider_configured(provider_id: str) -> bool:
    """Check if a provider has its required environment variables set.

    Args:
        provider_id: The unique identifier for the provider (e.g., 'apollo')

    Returns:
        True if all required env vars are set and non-empty, False otherwise.
    """
    provider = get_provider(provider_id)
    if not provider:
        return False

    # Check for multiple env keys (e.g., ZoomInfo)
    if "env_keys" in provider:
        env_keys = provider["env_keys"]
        return all(_is_env_var_set(key) for key in env_keys)

    # Check for single env key
    if "env_key" in provider:
        return _is_env_var_set(provider["env_key"])

    return False


def _is_env_var_set(key: str) -> bool:
    """Check if an environment variable is set to a real value.

    Returns False for empty strings or placeholder values starting with 'your_'.
    """
    value = os.getenv(key)
    if not value:
        return False
    if value.startswith("your_"):
        return False
    return True


def get_segment_primary_provider(segment_id: str) -> Optional[str]:
    """Get the primary (first) provider for a segment.

    Args:
        segment_id: The unique identifier for the segment

    Returns:
        Provider ID string, or None if segment not found or has no providers.
    """
    segment = get_segment(segment_id)
    if not segment:
        return None

    cascade = segment.get("providers", {}).get("cascade", [])
    return cascade[0] if cascade else None


def get_provider_display_name(provider_id: str) -> str:
    """Get the display name for a provider.

    Args:
        provider_id: The unique identifier for the provider

    Returns:
        Display name string, or the provider_id if not found.
    """
    provider = get_provider(provider_id)
    if provider:
        return provider.get("name", provider_id)
    return provider_id


def reload_config() -> None:
    """Force reload of configuration from file.

    Useful for testing or when you know the config has changed.
    """
    global _config_cache, _config_mtime
    _config_cache = None
    _config_mtime = None
    _load_config()


def get_full_config() -> dict:
    """Return the entire configuration dictionary for editing.

    Returns:
        Complete configuration dictionary including segments and providers.
    """
    return _load_config().copy()


def save_config(config_dict: dict) -> bool:
    """Save configuration dictionary to segments.json.

    Args:
        config_dict: The complete configuration dictionary to save.

    Returns:
        True if save was successful, False otherwise.

    Raises:
        ValueError: If config_dict is missing required keys.
    """
    global _config_cache, _config_mtime

    # Validate required keys
    if "segments" not in config_dict:
        raise ValueError("Configuration must contain 'segments' key")
    if "providers" not in config_dict:
        raise ValueError("Configuration must contain 'providers' key")

    # Write to file with pretty formatting
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config_dict, f, indent=2)

        # Invalidate cache to force reload on next access
        _config_cache = None
        _config_mtime = None

        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False
