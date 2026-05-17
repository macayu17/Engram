from sentence_transformers import SentenceTransformer

from api.config import settings


_model: SentenceTransformer | None = None


def load_model() -> None:
    global _model
    _model = SentenceTransformer(settings.embedding_model)


def is_model_loaded() -> bool:
    return _model is not None


def get_model() -> SentenceTransformer:
    if _model is None:
        raise RuntimeError("Embedding model not loaded")
    return _model


def embed(text: str) -> list[float]:
    return get_model().encode(text, normalize_embeddings=True).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    return get_model().encode(texts, normalize_embeddings=True).tolist()


def format_embedding_for_pgvector(embedding: list[float]) -> str:
    return "[" + ",".join(f"{value:.12g}" for value in embedding) + "]"
