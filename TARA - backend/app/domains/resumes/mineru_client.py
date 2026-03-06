import json
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib import error, request
from uuid import uuid4

from app.platform.settings import get_settings

settings = get_settings()

try:
    import pypdfium2 as pdfium
except Exception:  # pragma: no cover - optional dependency guard at import time
    pdfium = None

PREFERRED_FILE_FIELDS = ("file", "files", "upload_file", "document", "pdf", "image")
PREFERRED_TEXT_KEYS = (
    "text",
    "markdown",
    "md_content",
    "content",
    "parsed_text",
    "plain_text",
    "full_text",
    "result",
    "output",
    "data",
)
SKIP_METADATA_KEYS = {
    "type",
    "bbox",
    "angle",
    "confidence",
    "score",
    "id",
    "page",
    "index",
}
DEFAULT_ENDPOINT_CANDIDATES = (
    "/process-image",
    "/parse",
    "/extract",
    "/api/v1/parse",
    "/api/v1/extract",
    "/convert",
    "/api/v1/convert",
)


class MinerUClientError(RuntimeError):
    pass


@dataclass(frozen=True)
class MinerUEndpoint:
    path: str
    file_field: str


_DISCOVERED_ENDPOINT: MinerUEndpoint | None = None


def extract_text_with_mineru(*, file_name: str, content_type: str, data: bytes) -> str:
    endpoint_candidates = _endpoint_candidates()
    if _looks_like_pdf(file_name=file_name, content_type=content_type, data=data):
        return _extract_pdf_via_images(endpoint_candidates=endpoint_candidates, file_name=file_name, data=data)
    return _extract_blob_via_endpoints(
        endpoint_candidates=endpoint_candidates,
        file_name=file_name,
        content_type=content_type,
        data=data,
    )


def _extract_pdf_via_images(*, endpoint_candidates: list[MinerUEndpoint], file_name: str, data: bytes) -> str:
    if pdfium is None:
        raise MinerUClientError("PDF parsing requires pypdfium2. Rebuild backend image to install dependencies.")

    try:
        document = pdfium.PdfDocument(data)
    except Exception as exc:
        raise MinerUClientError(f"Unable to open PDF for MinerU parsing: {exc}") from exc

    try:
        page_count = len(document)
        if page_count <= 0:
            raise MinerUClientError("PDF is empty and cannot be parsed")

        max_pages = _effective_page_limit(page_count=page_count)
        rendered_chunks: list[str] = []
        base_name = Path(file_name).stem or "resume"

        for page_index in range(max_pages):
            png_bytes = _render_page_to_png(document=document, page_index=page_index)
            page_name = f"{base_name}_page_{page_index + 1}.png"
            text = _extract_blob_via_endpoints(
                endpoint_candidates=endpoint_candidates,
                file_name=page_name,
                content_type="image/png",
                data=png_bytes,
            )
            if text.strip():
                rendered_chunks.append(text.strip())

        if rendered_chunks:
            return "\n\n".join(rendered_chunks).strip()
        raise MinerUClientError("MinerU did not return text for any rendered PDF page")
    finally:
        document.close()


def _effective_page_limit(*, page_count: int) -> int:
    configured = settings.mineru_pdf_max_pages
    if configured <= 0:
        return page_count
    return min(page_count, configured)


def _render_page_to_png(*, document: Any, page_index: int) -> bytes:
    page = document[page_index]
    try:
        bitmap = page.render(scale=settings.mineru_pdf_render_scale)
        try:
            image = bitmap.to_pil()
            buffer = BytesIO()
            image.save(buffer, format="PNG")
            image.close()
            return buffer.getvalue()
        finally:
            if hasattr(bitmap, "close"):
                bitmap.close()
    except Exception as exc:
        raise MinerUClientError(f"Failed to render PDF page {page_index + 1} for MinerU: {exc}") from exc
    finally:
        page.close()


def _looks_like_pdf(*, file_name: str, content_type: str, data: bytes) -> bool:
    suffix = Path(file_name or "").suffix.lower()
    if suffix == ".pdf":
        return True

    content = (content_type or "").lower()
    if "pdf" in content:
        return True

    return data[:5] == b"%PDF-"


def _extract_blob_via_endpoints(
    *,
    endpoint_candidates: list[MinerUEndpoint],
    file_name: str,
    content_type: str,
    data: bytes,
) -> str:
    last_error: Exception | None = None
    for endpoint in endpoint_candidates:
        try:
            payload = _post_multipart(endpoint=endpoint, file_name=file_name, content_type=content_type, data=data)
            text = _extract_text_from_payload(payload)
            if text:
                return text
            last_error = MinerUClientError("MinerU response did not contain readable text")
        except (MinerUClientError, TimeoutError, ValueError, OSError) as exc:
            last_error = exc
            continue

    if last_error:
        raise MinerUClientError(f"MinerU parse failed: {last_error}") from last_error
    raise MinerUClientError("MinerU parse failed: no endpoint candidates available")


def _endpoint_candidates() -> list[MinerUEndpoint]:
    configured_path = _normalize_path(settings.mineru_api_extract_path)
    if configured_path and configured_path != "auto":
        return [MinerUEndpoint(path=configured_path, file_field=settings.mineru_api_file_field)]

    discovered = _discover_endpoint()
    discovered_entries = [discovered] if discovered else []

    entries: list[MinerUEndpoint] = []
    seen: set[tuple[str, str]] = set()
    for entry in discovered_entries + _configured_fallback_endpoints():
        key = (entry.path, entry.file_field)
        if key in seen:
            continue
        seen.add(key)
        entries.append(entry)
    return entries


def _configured_fallback_endpoints() -> list[MinerUEndpoint]:
    raw = settings.mineru_api_candidate_paths.strip()
    candidates = [piece.strip() for piece in raw.split(",") if piece.strip()]
    if not candidates:
        candidates = list(DEFAULT_ENDPOINT_CANDIDATES)

    entries: list[MinerUEndpoint] = []
    for path in candidates:
        normalized_path = _normalize_path(path)
        preferred_fields: list[str] = [settings.mineru_api_file_field]
        if "image" in normalized_path.lower() and "image" not in preferred_fields:
            preferred_fields.insert(0, "image")
        if "file" not in preferred_fields:
            preferred_fields.append("file")

        for file_field in preferred_fields:
            entries.append(MinerUEndpoint(path=normalized_path, file_field=file_field))
    return entries


def _discover_endpoint() -> MinerUEndpoint | None:
    global _DISCOVERED_ENDPOINT
    if _DISCOVERED_ENDPOINT:
        return _DISCOVERED_ENDPOINT

    try:
        openapi = _http_json(url=_absolute_url("/openapi.json"), timeout_seconds=settings.mineru_api_timeout_seconds)
    except Exception:
        # Do not cache failures; MinerU may still be booting.
        return None

    paths = openapi.get("paths", {})
    components = openapi.get("components", {})

    ranked: list[tuple[int, MinerUEndpoint]] = []
    for path, methods in paths.items():
        if not isinstance(methods, dict):
            continue
        post_spec = methods.get("post")
        if not isinstance(post_spec, dict):
            continue
        request_body = post_spec.get("requestBody", {})
        content = request_body.get("content", {})
        multipart = content.get("multipart/form-data")
        if not isinstance(multipart, dict):
            continue

        schema = multipart.get("schema")
        fields = _binary_fields(schema=schema, components=components)
        if not fields:
            continue

        file_field = next((candidate for candidate in PREFERRED_FILE_FIELDS if candidate in fields), fields[0])
        score = _score_endpoint_path(path)
        ranked.append((score, MinerUEndpoint(path=_normalize_path(path), file_field=file_field)))

    if not ranked:
        return None

    ranked.sort(key=lambda item: item[0], reverse=True)
    _DISCOVERED_ENDPOINT = ranked[0][1]
    return _DISCOVERED_ENDPOINT


def _score_endpoint_path(path: str) -> int:
    normalized = path.lower()
    score = 0
    if "parse" in normalized:
        score += 50
    if "extract" in normalized:
        score += 45
    if "convert" in normalized:
        score += 35
    if "ocr" in normalized:
        score += 20
    if "upload" in normalized:
        score += 10
    score -= len(normalized) // 10
    return score


def _binary_fields(*, schema: Any, components: dict[str, Any]) -> list[str]:
    resolved = _resolve_schema_ref(schema=schema, components=components)
    if not isinstance(resolved, dict):
        return []

    properties = resolved.get("properties")
    if not isinstance(properties, dict):
        return []

    binary_fields: list[str] = []
    for field_name, field_schema in properties.items():
        field_resolved = _resolve_schema_ref(schema=field_schema, components=components)
        if not isinstance(field_resolved, dict):
            continue
        if field_resolved.get("type") == "string" and field_resolved.get("format") == "binary":
            binary_fields.append(field_name)
    return binary_fields


def _resolve_schema_ref(*, schema: Any, components: dict[str, Any]) -> Any:
    if not isinstance(schema, dict):
        return schema

    reference = schema.get("$ref")
    if not isinstance(reference, str) or not reference.startswith("#/"):
        return schema

    current: Any = {"components": components}
    for key in reference[2:].split("/"):
        if not isinstance(current, dict) or key not in current:
            return schema
        current = current[key]
    return current


def _post_multipart(*, endpoint: MinerUEndpoint, file_name: str, content_type: str, data: bytes) -> Any:
    boundary = f"----tara-mineru-{uuid4().hex}"
    body = _multipart_body(
        boundary=boundary,
        field_name=endpoint.file_field,
        file_name=file_name,
        content_type=content_type,
        data=data,
    )
    req = request.Request(
        url=_absolute_url(endpoint.path),
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with request.urlopen(req, timeout=settings.mineru_api_timeout_seconds) as response:
            raw = response.read()
            mime = response.headers.get("Content-Type", "").lower()
    except error.HTTPError as exc:
        details = _safe_decode(exc.read())
        raise MinerUClientError(f"HTTP {exc.code} on {endpoint.path}: {details}") from exc
    except error.URLError as exc:
        raise MinerUClientError(f"Unable to connect to MinerU at {endpoint.path}: {exc}") from exc

    if "application/json" in mime:
        try:
            return json.loads(_safe_decode(raw))
        except json.JSONDecodeError as exc:
            raise MinerUClientError(f"Invalid JSON from MinerU endpoint {endpoint.path}") from exc
    return _safe_decode(raw)


def _multipart_body(*, boundary: str, field_name: str, file_name: str, content_type: str, data: bytes) -> bytes:
    safe_name = file_name.replace('"', "")
    segments = [
        f"--{boundary}\r\n".encode("utf-8"),
        f'Content-Disposition: form-data; name="{field_name}"; filename="{safe_name}"\r\n'.encode("utf-8"),
        f"Content-Type: {content_type or 'application/octet-stream'}\r\n\r\n".encode("utf-8"),
        data,
        b"\r\n",
        f"--{boundary}--\r\n".encode("utf-8"),
    ]
    return b"".join(segments)


def _extract_text_from_payload(payload: Any) -> str:
    strings = [item.strip() for item in _collect_text_snippets(payload) if item.strip()]
    if not strings:
        return ""

    ordered: list[str] = []
    seen: set[str] = set()
    for snippet in strings:
        key = snippet.lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(snippet)

    return "\n".join(ordered).strip()


def _collect_text_snippets(value: Any) -> list[str]:
    snippets: list[str] = []

    if isinstance(value, str):
        text = value.strip()
        if text:
            snippets.append(text)
        return snippets

    if isinstance(value, list):
        for item in value:
            snippets.extend(_collect_text_snippets(item))
        return snippets

    if isinstance(value, dict):
        for key in PREFERRED_TEXT_KEYS:
            if key in value:
                snippets.extend(_collect_text_snippets(value[key]))
        for key, item in value.items():
            if key in PREFERRED_TEXT_KEYS or key in SKIP_METADATA_KEYS:
                continue
            snippets.extend(_collect_text_snippets(item))
        return snippets

    return snippets


def _http_json(*, url: str, timeout_seconds: int) -> dict[str, Any]:
    req = request.Request(url=url, method="GET", headers={"Accept": "application/json"})
    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            body = _safe_decode(response.read())
    except error.HTTPError as exc:
        details = _safe_decode(exc.read())
        raise MinerUClientError(f"HTTP {exc.code} while reading MinerU OpenAPI: {details}") from exc
    except error.URLError as exc:
        raise MinerUClientError(f"Could not reach MinerU OpenAPI: {exc}") from exc

    parsed = json.loads(body)
    if not isinstance(parsed, dict):
        raise MinerUClientError("Unexpected OpenAPI payload from MinerU")
    return parsed


def _absolute_url(path: str) -> str:
    base = settings.mineru_api_base_url.rstrip("/")
    normalized = _normalize_path(path)
    return f"{base}{normalized}"


def _normalize_path(path: str) -> str:
    value = (path or "").strip()
    if not value:
        return ""
    if value.lower() == "auto":
        return "auto"
    if not value.startswith("/"):
        value = f"/{value}"
    return value


def _safe_decode(payload: bytes) -> str:
    return payload.decode("utf-8", errors="replace")
