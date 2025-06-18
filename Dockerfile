FROM oven/bun:1 AS base

RUN mkdir -p /usr/src/noshame
WORKDIR /usr/src/noshame

COPY . /usr/src/noshame
RUN bun install

CMD ["bun", "run", "src/index.ts"]