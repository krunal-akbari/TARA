FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends antiword \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r appuser && useradd -r -g appuser -u 1001 appuser

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DATABASE_URL=sqlite:////var/lib/tara/tara.db
ENV LOCAL_STORAGE_PATH=/var/lib/tara/storage

WORKDIR /app

COPY --chown=appuser:appuser pyproject.toml /app/
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .[dev]

COPY --chown=appuser:appuser . /app
RUN mkdir -p /var/lib/tara/storage && chown -R appuser:appuser /var/lib/tara

USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
