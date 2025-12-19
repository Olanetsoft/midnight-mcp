FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
