import os
from dotenv import load_dotenv

load_dotenv()


def get_api_key(key_name: str) -> str | None:
    """Get API key from environment, return None if not set."""
    value = os.getenv(key_name)
    if value and value.startswith("your_"):
        return None
    return value


# API Keys
SERPER_API_KEY = get_api_key("SERPER_API_KEY")
APOLLO_API_KEY = get_api_key("APOLLO_API_KEY")
ZOOMINFO_CLIENT_ID = get_api_key("ZOOMINFO_CLIENT_ID")
ZOOMINFO_CLIENT_SECRET = get_api_key("ZOOMINFO_CLIENT_SECRET")
CLAY_API_KEY = get_api_key("CLAY_API_KEY")
GRAPHIQ_API_KEY = get_api_key("GRAPHIQ_API_KEY")


def check_provider_configured(provider: str) -> bool:
    """Check if a provider has its API keys configured."""
    checks = {
        "serper": bool(SERPER_API_KEY),
        "apollo": bool(APOLLO_API_KEY),
        "zoominfo": bool(ZOOMINFO_CLIENT_ID and ZOOMINFO_CLIENT_SECRET),
        "clay": bool(CLAY_API_KEY),
        "graphiq": bool(GRAPHIQ_API_KEY),
    }
    return checks.get(provider, False)
