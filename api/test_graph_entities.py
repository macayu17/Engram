from uuid import uuid4

from api.services.graph import _containment_edges, _parse_entity_strings


def test_parse_dedupes_case_and_type_variants() -> None:
    parsed = _parse_entity_strings(["Cutscene|project", "cutscene|topic", "ChatGPT|technology"])
    assert [p["name"] for p in parsed] == ["Cutscene", "ChatGPT"]


def test_parse_skips_invalid() -> None:
    assert _parse_entity_strings(["no-pipe", "|project", "X|badtype"]) == []


def test_containment_links_variants_not_substrings() -> None:
    cutscene, system, java, javascript = uuid4(), uuid4(), uuid4(), uuid4()
    edges = _containment_edges(
        [
            {"id": cutscene, "name": "Cutscene"},
            {"id": system, "name": "Cutscene System"},
            {"id": java, "name": "Java"},
            {"id": javascript, "name": "JavaScript"},
        ]
    )
    assert edges == [(cutscene, system)]
