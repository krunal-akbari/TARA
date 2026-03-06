from app.domains.resumes import mineru_client


def test_configured_fallback_endpoints_include_image_field(monkeypatch):
    monkeypatch.setattr(mineru_client.settings, "mineru_api_candidate_paths", "/process-image")
    monkeypatch.setattr(mineru_client.settings, "mineru_api_file_field", "file")

    endpoints = mineru_client._configured_fallback_endpoints()

    assert len(endpoints) >= 2
    assert endpoints[0].path == "/process-image"
    assert endpoints[0].file_field == "image"
    assert endpoints[1].path == "/process-image"
    assert endpoints[1].file_field == "file"


def test_extract_pdf_via_images_calls_mineru_per_page(monkeypatch):
    class FakeDocument:
        def __init__(self, _: bytes) -> None:
            self.closed = False

        def __len__(self) -> int:
            return 5

        def __getitem__(self, index: int):  # noqa: ANN201
            return index

        def close(self) -> None:
            self.closed = True

    class FakePdfium:
        PdfDocument = FakeDocument

    endpoint = mineru_client.MinerUEndpoint(path="/process-image", file_field="image")
    seen_names: list[str] = []

    def fake_render_page_to_png(*, document, page_index: int) -> bytes:  # noqa: ANN001
        _ = document
        return f"page-{page_index}".encode("utf-8")

    def fake_extract_blob_via_endpoints(*, endpoint_candidates, file_name: str, content_type: str, data: bytes) -> str:  # noqa: ANN001,E501
        _ = (endpoint_candidates, content_type, data)
        seen_names.append(file_name)
        return f"text from {file_name}"

    monkeypatch.setattr(mineru_client, "pdfium", FakePdfium)
    monkeypatch.setattr(mineru_client.settings, "mineru_pdf_max_pages", 3)
    monkeypatch.setattr(mineru_client, "_render_page_to_png", fake_render_page_to_png)
    monkeypatch.setattr(mineru_client, "_extract_blob_via_endpoints", fake_extract_blob_via_endpoints)

    merged = mineru_client._extract_pdf_via_images(
        endpoint_candidates=[endpoint],
        file_name="resume.pdf",
        data=b"%PDF-1.4 fake",
    )

    assert seen_names == ["resume_page_1.png", "resume_page_2.png", "resume_page_3.png"]
    assert "text from resume_page_1.png" in merged
    assert "text from resume_page_3.png" in merged


def test_looks_like_pdf_detects_from_header() -> None:
    assert mineru_client._looks_like_pdf(file_name="resume.bin", content_type="", data=b"%PDF-2.0 binary")
    assert not mineru_client._looks_like_pdf(file_name="resume.bin", content_type="", data=b"not-pdf")


def test_extract_text_from_payload_merges_content_chunks() -> None:
    payload = [
        {"type": "title", "content": "John Doe"},
        {"type": "text", "content": "john.doe@example.com"},
        {"type": "text", "content": "+1 555 111 2222"},
    ]

    merged = mineru_client._extract_text_from_payload(payload)

    assert "John Doe" in merged
    assert "john.doe@example.com" in merged
    assert "+1 555 111 2222" in merged
    assert "title" not in merged.lower()
