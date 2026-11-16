FROM python:3.12-slim
WORKDIR /app
COPY services/science /app/services/science
COPY data /app/data
COPY research /app/research
RUN pip install --no-cache-dir numpy fastapi uvicorn pydantic httpx rasterio pyproj spiceypy
ENV PYTHONPATH=/app/services/science/src
EXPOSE 8000
CMD ["uvicorn", "lfl.api:app", "--host", "0.0.0.0", "--port", "8000"]
