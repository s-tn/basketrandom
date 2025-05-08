# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=23.11.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Next.js/Prisma"

# Next.js/Prisma app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp openssl pkg-config python-is-python3 ffmpeg

# Install node modules
COPY package-lock.json package.json ./
COPY prisma .
RUN npm ci --include=dev

# Generate Prisma Client
RUN npx prisma generate

# Copy application code
COPY . .

# Build application
RUN npx next build --experimental-build-mode compile

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates chromium chromium-sandbox openssl wget ffmpeg chromium && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives 

# Install litestream
RUN wget https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.deb && \
    dpkg -i litestream-v0.3.13-linux-amd64.deb && \
    rm litestream-v0.3.13-linux-amd64.deb

# Copy built application
COPY --from=build /app /app

# Setup sqlite3 on a separate volume
# clear /data
RUN rm -rf /data
RUN mkdir -p /data
VOLUME /data

RUN echo "Chromium is at: $(which chromium)" && \
    echo "CHROMIUM_PATH=$(which chromium)" >> /etc/environment

# Entrypoint prepares the database.
ENTRYPOINT [ "/app/docker-entrypoint.js" ]

# Start the server by default, this can be overwritten at runtime
EXPOSE 9000
ENV PORT=9000
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max_old_space_size=4096 --unhandled-rejections=none"
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"
CMD [ "npm", "run", "start" ]
