from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    FeedbackCreate,
    FeedbackOut,
    ReviewCreate,
    ReviewOut,
    ReviewSummaryOut,
    WaitlistCreate,
    WaitlistOut,
)
from app.services.engagement_service import EngagementService

router = APIRouter(prefix="/api/public", tags=["Engagement"])


@router.post("/waitlist", response_model=WaitlistOut, status_code=201)
async def join_waitlist(
    data: WaitlistCreate,
    db: AsyncSession = Depends(get_db),
):
    return await EngagementService(db).join_waitlist(data)


@router.get("/reviews", response_model=ReviewSummaryOut)
async def reviews(
    limit: int = Query(default=12, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    return await EngagementService(db).public_reviews(limit)


@router.post("/reviews", response_model=ReviewOut, status_code=201)
async def create_review(
    data: ReviewCreate,
    db: AsyncSession = Depends(get_db),
):
    return await EngagementService(db).create_review(data)


@router.post("/feedback", response_model=FeedbackOut, status_code=201)
async def create_feedback(
    data: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
):
    return await EngagementService(db).create_feedback(data)
