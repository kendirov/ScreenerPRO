FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir .
RUN mkdir -p /app/data
EXPOSE 8787
CMD ["uvicorn", "tqs_intelligence.api:app", "--host", "0.0.0.0", "--port", "8787"]
