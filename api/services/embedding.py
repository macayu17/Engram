from typing import Protocol

from api.config import settings


class EmbeddingModel(Protocol):
    def encode(self, sentences: str | list[str], normalize_embeddings: bool) -> object:
        ...


_model: EmbeddingModel | None = None


def load_model() -> None:
    from sentence_transformers import SentenceTransformer

    global _model
    _model = SentenceTransformer(settings.embedding_model)


def is_model_loaded() -> bool:
    return _model is not None


def get_model() -> EmbeddingModel:
    if _model is None:
        raise RuntimeError("Embedding model not loaded")
    return _model


def embed(text: str) -> list[float]:
    return to_float_vector(get_model().encode(text, normalize_embeddings=True))


def embed_batch(texts: list[str]) -> list[list[float]]:
    encoded = get_model().encode(texts, normalize_embeddings=True)
    if hasattr(encoded, "tolist"):
        encoded = encoded.tolist()
    if not isinstance(encoded, list):
        raise RuntimeError("Embedding batch output is not a list")
    return [to_float_vector(vector) for vector in encoded]


def to_float_vector(value: object) -> list[float]:
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, list):
        raise RuntimeError("Embedding output is not a list")
    return [float(item) for item in value]


def format_embedding_for_pgvector(embedding: list[float]) -> str:
    return "[" + ",".join(f"{value:.12g}" for value in embedding) + "]"
