# Distribution

[Back to main documentation](../CLAUDE.md)

---

## Status

**100% Complete** - Docker, npm/npx, and CI/CD workflows are fully implemented.

---

## Distribution Options

| Method | Use Case | Status |
|--------|----------|--------|
| Docker | Self-hosted, teams, CI/CD | Implemented |
| npm/npx | Developer local use | Implemented |
| Desktop App | Non-technical users | Future |
| Cloud SaaS | Zero install | Future |

---

## Docker Distribution

### Quick Start

```bash
# Using Docker directly
docker run -d -p 3000:3000 --name sendr ghcr.io/yourusername/sendr:latest

# Using Docker Compose
curl -O https://raw.githubusercontent.com/yourusername/sendr/main/docker-compose.yml
docker-compose up -d

# Access at http://localhost:3000
```

### Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  sendr:
    build: .
    image: sendr:latest
    container_name: sendr
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

### Multi-Architecture Support

Builds support both AMD64 and ARM64 (Apple Silicon, AWS Graviton):

```yaml
# In GitHub Actions
- name: Build and push multi-arch
  uses: docker/build-push-action@v5
  with:
    platforms: linux/amd64,linux/arm64
```

---

## npm/npx Distribution

### Installation

```bash
# Global install
npm install -g sendr
sendr --port 3000

# Run directly with npx (no install)
npx sendr
npx sendr --port 8080

# Add to project
npm install --save-dev sendr
npx sendr
```

### CLI Entry Point

Located at `bin/cli.js`:

```javascript
#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const port = args.find(a => a.startsWith('--port='))?.split('=')[1] ||
             args[args.indexOf('-p') + 1] ||
             process.env.PORT ||
             3000;

console.log(`Starting Sendr on http://localhost:${port}`);

process.env.PORT = port;
const serverPath = path.join(__dirname, '..', '.next', 'standalone', 'server.js');

const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port }
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
  process.exit(0);
});
```

### Package Configuration

```json
{
  "name": "sendr",
  "version": "1.0.0",
  "bin": {
    "sendr": "./bin/cli.js"
  },
  "files": [
    "bin/",
    ".next/standalone/",
    ".next/static/",
    "public/"
  ]
}
```

---

## CI/CD Workflows

### Docker Publish (GitHub Actions)

`.github/workflows/docker-publish.yml`:

```yaml
name: Build and Push Docker Image

on:
  push:
    tags:
      - 'v*'
  release:
    types: [published]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## Environment Variables

```bash
PORT=3000                    # Server port (default: 3000)
HOST=0.0.0.0                 # Bind address (default: 0.0.0.0)
NODE_ENV=production          # Environment mode
```

---

## Versioning Strategy

Follow Semantic Versioning (SemVer):
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features
- **PATCH** (1.0.0 → 1.0.1): Bug fixes

### Docker Tags

| Tag | Description |
|-----|-------------|
| `latest` | Most recent stable release |
| `1.0.0` | Specific version (immutable) |
| `1.0` | Latest patch of minor version |
| `1` | Latest minor of major version |
| `edge` | Latest commit on main branch |

---

## Release Checklist

### Pre-release
- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Run full test suite
- [ ] Test Docker build locally
- [ ] Test npm pack and install locally

### Release Process
- [ ] Create git tag (v1.0.0)
- [ ] Push tag to trigger CI/CD
- [ ] Verify Docker image published
- [ ] Publish to npm (`npm publish`)
- [ ] Create GitHub Release

### Post-release
- [ ] Verify Docker image works
- [ ] Verify npm package works
- [ ] Announce release

---

## Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Docker build configuration |
| `docker-compose.yml` | Docker Compose configuration |
| `bin/cli.js` | npm CLI entry point |
| `.github/workflows/docker-publish.yml` | Docker CI/CD workflow |
| `.github/workflows/npm-publish.yml` | npm CI/CD workflow |
| `next.config.js` | Next.js standalone configuration |
