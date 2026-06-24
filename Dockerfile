# VoiceBridge AI — speech-to-text + translation backend for PODS voice widget.
FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY nest-cli.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN yarn build
RUN node scripts/warmup-model.mjs

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV WHISPER_MODEL=Xenova/whisper-base

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 1000 voicebridge \
  && useradd --uid 1000 --gid voicebridge --create-home voicebridge

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production \
  && yarn cache clean

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/@xenova/transformers/.cache \
  ./node_modules/@xenova/transformers/.cache

RUN mkdir -p data uploads \
  && chown -R voicebridge:voicebridge /app

USER voicebridge

EXPOSE 3001

CMD ["node", "dist/main"]
