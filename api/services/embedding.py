from typing import Protocol

from api.config import settings


class EmbeddingModel(Protocol):
    def encode(self, sentences: str | list[str], normalize_embeddings: bool) -> object:
        ...


class RerankerModel(Protocol):
    def predict(self, pairs: list[tuple[str, str]]) -> object:
        ...


_model: EmbeddingModel | None = None
_reranker: RerankerModel | None = None


def load_model() -> None:
    from sentence_transformers import SentenceTransformer

    global _model
    _model = SentenceTransformer(settings.embedding_model)


def load_reranker() -> None:
    from sentence_transformers import CrossEncoder

    global _reranker
    _reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def is_reranker_loaded() -> bool:
    return _reranker is not None


def rerank(query: str, candidates: list[str]) -> list[float]:
    if _reranker is None:
        raise RuntimeError("Reranker not loaded")
    pairs = [(query, c) for c in candidates]
    scores = _reranker.predict(pairs)
    if hasattr(scores, "tolist"):
        scores = scores.tolist()
    return [float(s) for s in scores]


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
