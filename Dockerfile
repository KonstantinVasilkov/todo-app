FROM ghcr.io/astral-sh/uv:0.11.26 AS uv

FROM python:3.14.9-slim AS build
COPY --from=uv /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./

FROM python:3.14.9-slim AS runtime
ENV PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    DATABASE_URL=sqlite+aiosqlite:////data/todo.db
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin todo \
    && mkdir /data \
    && chown todo:todo /data
WORKDIR /app
COPY --from=build /app /app
USER todo
VOLUME /data
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec fastapi run app/main.py --host 0.0.0.0 --port 8000 --root-path /api"]
