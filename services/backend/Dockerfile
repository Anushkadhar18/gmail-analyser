FROM python:3.12-slim
WORKDIR /app
COPY services/backend/requirements.txt /app/services/backend/requirements.txt
RUN pip install --no-cache-dir -r services/backend/requirements.txt
COPY services/backend /app/services/backend
COPY services/worker /app/services/worker
ENV PYTHONPATH=/app
CMD ["uvicorn", "services.backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
