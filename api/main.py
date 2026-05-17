"""Enrichment Switcher API - FastAPI backend for enrichment operations.

This API wraps the existing Python providers and provides:
- Segment configuration management
- Multi-provider search and enrichment
- BYOK (Bring Your Own Key) management
"""

import sys
from pathlib import Path

# Add parent directory to path so we can import providers and config
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from api.routers import segments, search, keys, test

# Create FastAPI app
app = FastAPI(
    title="Enrichment Switcher API",
    description="API for managing enrichment segments and executing searches across multiple providers",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",  # Vite default port
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions gracefully."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred",
            "error": str(exc),
        },
    )


# Include routers
app.include_router(segments.router)
app.include_router(search.router)
app.include_router(keys.router)
app.include_router(test.router)


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "service": "enrichment-switcher-api"}


# Root endpoint
@app.get("/", tags=["root"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Enrichment Switcher API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# Startup event
@app.on_event("startup")
async def startup_event():
    """Actions to perform on application startup."""
    print("Enrichment Switcher API starting up...")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Actions to perform on application shutdown."""
    print("Enrichment Switcher API shutting down...")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
