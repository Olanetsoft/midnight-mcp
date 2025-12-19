FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/

# Set environment
ENV NODE_ENV=production

# Run the server
CMD ["node", "dist/index.js"]
