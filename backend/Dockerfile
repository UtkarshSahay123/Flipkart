FROM node:22-bookworm-slim AS dashboard-build
WORKDIR /workspace/roadguard-admin/dashboard
COPY roadguard-admin/dashboard/package.json roadguard-admin/dashboard/package-lock.json ./
RUN npm ci
COPY roadguard-admin/dashboard/ ./
RUN npm run build

FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    HOME=/home/roadguard
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libglib2.0-0 libgl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /app/backend/requirements.txt

COPY . /app
COPY --from=dashboard-build /workspace/roadguard-admin/dashboard/dist /app/roadguard-admin/dashboard/dist

RUN useradd --system --uid 10001 --create-home --home-dir /home/roadguard roadguard \
    && mkdir -p /app/temp \
    && chown -R roadguard:roadguard /app /home/roadguard

USER 10001
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port \"${PORT:-8000}\" --workers 1 --limit-concurrency 20 --timeout-keep-alive 5"]
