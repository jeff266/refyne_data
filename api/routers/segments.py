"""Segments router for managing enrichment segments configuration."""

from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from config_loader import (
    get_segments,
    get_segment,
    get_full_config,
    save_config,
    reload_config,
)

router = APIRouter(prefix="/segments", tags=["segments"])


# Pydantic models for request/response validation

class InputField(BaseModel):
    """Configuration for a segment input field."""
    id: str
    type: str  # text, select, textarea, radio, slider
    label: str
    placeholder: Optional[str] = None
    required: Optional[bool] = False
    source: Optional[str] = None
    options: Optional[list[str]] = None
    default: Optional[str | int] = None
    min: Optional[int] = None
    max: Optional[int] = None
    height: Optional[int] = None
    horizontal: Optional[bool] = None
    show_when: Optional[dict] = None


class ProviderConfig(BaseModel):
    """Provider cascade configuration for a segment."""
    cascade: list[str]
    fallback_enabled: bool = False
    fallback: Optional[list[str]] = None


class SegmentBase(BaseModel):
    """Base segment model with common fields."""
    display_name: str
    description: str
    icon: str = "business"
    visible: bool = True
    providers: ProviderConfig
    input_fields: list[InputField]


class SegmentCreate(SegmentBase):
    """Model for creating a new segment."""
    id: str = Field(..., pattern=r"^[a-z][a-z0-9_]*$")


class SegmentUpdate(BaseModel):
    """Model for updating a segment (all fields optional)."""
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    visible: Optional[bool] = None
    order: Optional[int] = None
    providers: Optional[ProviderConfig] = None
    input_fields: Optional[list[InputField]] = None


class SegmentResponse(SegmentBase):
    """Segment response model."""
    id: str
    order: int


class ReorderRequest(BaseModel):
    """Request model for reordering segments."""
    segment_ids: list[str] = Field(..., description="Ordered list of segment IDs")


@router.get("", response_model=list[SegmentResponse])
async def list_segments():
    """List all visible segments sorted by display order."""
    segments = get_segments()
    return segments


@router.get("/{segment_id}", response_model=SegmentResponse)
async def get_segment_by_id(segment_id: str):
    """Get a single segment by ID."""
    segment = get_segment(segment_id)
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Segment '{segment_id}' not found",
        )
    return segment


@router.post("", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED)
async def create_segment(segment: SegmentCreate):
    """Create a new segment."""
    config = get_full_config()
    segments = config.get("segments", [])

    # Check if ID already exists
    existing_ids = {s["id"] for s in segments}
    if segment.id in existing_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Segment with ID '{segment.id}' already exists",
        )

    # Determine order (add to end)
    max_order = max((s.get("order", 0) for s in segments), default=0)

    # Create new segment dict
    new_segment = segment.model_dump()
    new_segment["order"] = max_order + 1

    # Add to config and save
    segments.append(new_segment)
    config["segments"] = segments

    if not save_config(config):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save configuration",
        )

    reload_config()
    return new_segment


@router.put("/{segment_id}", response_model=SegmentResponse)
async def update_segment(segment_id: str, segment_update: SegmentUpdate):
    """Update an existing segment."""
    config = get_full_config()
    segments = config.get("segments", [])

    # Find the segment
    segment_index = None
    for i, s in enumerate(segments):
        if s.get("id") == segment_id:
            segment_index = i
            break

    if segment_index is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Segment '{segment_id}' not found",
        )

    # Update only provided fields
    existing_segment = segments[segment_index]
    update_data = segment_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if value is not None:
            if isinstance(value, dict) or isinstance(value, list):
                # For nested objects, convert Pydantic models to dicts
                if hasattr(value, "model_dump"):
                    existing_segment[key] = value.model_dump()
                elif isinstance(value, list):
                    existing_segment[key] = [
                        item.model_dump() if hasattr(item, "model_dump") else item
                        for item in value
                    ]
                else:
                    existing_segment[key] = value
            else:
                existing_segment[key] = value

    # Save updated config
    config["segments"] = segments
    if not save_config(config):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save configuration",
        )

    reload_config()
    return existing_segment


@router.delete("/{segment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_segment(segment_id: str):
    """Delete a segment."""
    config = get_full_config()
    segments = config.get("segments", [])

    # Find and remove the segment
    original_length = len(segments)
    segments = [s for s in segments if s.get("id") != segment_id]

    if len(segments) == original_length:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Segment '{segment_id}' not found",
        )

    # Save updated config
    config["segments"] = segments
    if not save_config(config):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save configuration",
        )

    reload_config()
    return None


@router.put("/reorder", response_model=list[SegmentResponse])
async def reorder_segments(reorder: ReorderRequest):
    """Reorder segments by providing an ordered list of segment IDs."""
    config = get_full_config()
    segments = config.get("segments", [])

    # Build a map of segment ID to segment
    segment_map = {s["id"]: s for s in segments}

    # Validate all IDs exist
    for segment_id in reorder.segment_ids:
        if segment_id not in segment_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Segment '{segment_id}' not found",
            )

    # Update order values
    for i, segment_id in enumerate(reorder.segment_ids, start=1):
        segment_map[segment_id]["order"] = i

    # Save updated config
    config["segments"] = list(segment_map.values())
    if not save_config(config):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save configuration",
        )

    reload_config()
    return get_segments()
