FROM python:3.11-slim

WORKDIR /app

# Install build deps for psycopg2 binary if needed
RUN apt-get update && apt-get install -y build-essential libpq-dev --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

# Use Gunicorn with Uvicorn workers for production-grade process management.
# Allow Render to set the PORT envvar; default to 8000.
ENV PORT=8000
CMD ["sh", "-c", "gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT"]
