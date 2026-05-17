import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Response, status

from api.dependencies import get_current_user, get_db
from api.models.user import UserCreate, UserCreateResponse, UserResponse
from api.services.users import create_user, delete_user


router = APIRouter()


@router.post("", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_user_route(payload: UserCreate, db: asyncpg.Connection = Depends(get_db)) -> dict[str, object]:
    try:
        row, api_key = await create_user(payload.external_id, db)
    except asyncpg.UniqueViolationError as error:
        raise HTTPException(status_code=409, detail="User external_id already exists") from error
    return {
        "id": row["id"],
        "external_id": row["external_id"],
        "api_key": api_key,
        "created_at": row["created_at"],
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_route(user: asyncpg.Record = Depends(get_current_user)) -> dict[str, object]:
    return {
        "id": user["id"],
        "external_id": user["external_id"],
        "created_at": user["created_at"],
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> Response:
    deleted = await delete_user(user["id"], db)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
