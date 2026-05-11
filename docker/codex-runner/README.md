# Codex Runner

This is an opt-in one-shot container for running Codex CLI against this repository with an optional document mounted at `/documents`.

It is not part of the normal TARA stack. It only runs when the `codex` Compose profile is selected.

## First-Time ChatGPT Login

Build the runner, then sign in once:

```bash
docker-compose --profile codex build codex-runner
docker-compose --profile codex run --rm codex-runner codex login
```

Codex auth is stored in the `codex_home` Docker volume.

## Run With A Document

Put the document in `codex-documents/`, then run:

```bash
DOCUMENT_PATH=spec.md CODEX_PROMPT="Read this document and implement the requested changes." docker-compose --profile codex run --rm codex-runner
```

On PowerShell:

```powershell
$env:DOCUMENT_PATH = "spec.md"
$env:CODEX_PROMPT = "Read this document and implement the requested changes."
docker-compose --profile codex run --rm codex-runner
```

## Notes

- The repository is mounted at `/workspace`.
- `codex-documents/` is mounted read-only at `/documents`.
- This container does not reuse the Codex desktop app login automatically.
- For app resume parsing, use the backend native parser.
