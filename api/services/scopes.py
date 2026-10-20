from collections.abc import Mapping

from fastapi import HTTPException
from pydantic import TypeAdapter, ValidationError

from api.models.memory import Namespace


def resolve_namespace(user: Mapping[str, object], namespace: str | None) -> str | None:
    granted = user.get("oauth_namespace")
    if isinstance(granted, str):
        if namespace is not None and namespace != granted:
            raise HTTPException(status_code=403, detail="Connection is restricted to its authorized project")
        return granted
    if namespace is not None:
        try:
            return TypeAdapter(Namespace).validate_python(namespace)
        except ValidationError as error:
            raise HTTPException(status_code=422, detail="Invalid project name") from error
    return None


def require_personal_permission(user: Mapping[str, object], include_personal: bool) -> None:
    if include_personal and user.get("oauth_namespace") is not None:
        raise HTTPException(status_code=403, detail="Personal memory sharing is available through API-key connections only")
