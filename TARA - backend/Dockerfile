FROM python:3.12-slim

RUN groupadd -r appuser && useradd -r -g appuser -u 1001 appuser

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY --chown=appuser:appuser pyproject.toml /app/
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .[dev]

COPY --chown=appuser:appuser . /app

USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
