# Contributing to Midnight MCP

Thank you for your interest in contributing to Midnight MCP! This guide will help you get started.

## Getting Started

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/midnight-mcp.git
   cd midnight-mcp
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up environment**:
   ```bash
   cp .env.example .env
   # Add your GITHUB_TOKEN and optionally OPENAI_API_KEY
   ```
5. **Build and test**:
   ```bash
   npm run build
   npm test
   ```

## Development Workflow

### Running Locally
```bash
npm run dev    # Watch mode with hot reload
npm run build  # Production build
npm start      # Run built server
```

### Testing with MCP Inspector
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Code Style
- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public functions
- Run `npm run lint` before committing

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Add tests if applicable
4. Ensure `npm run build` and `npm test` pass
5. Commit with clear messages
6. Push and open a PR against `main`

## Areas for Contribution

- **New Tools**: Add tools for additional Midnight functionality
- **Documentation**: Improve docs and examples
- **Bug Fixes**: Fix issues and improve reliability
- **Performance**: Optimize caching and API calls
- **Tests**: Increase test coverage

## Code of Conduct

Be respectful and constructive. We're all here to build great tools for the Midnight ecosystem.

## Questions?

Open an issue or start a discussion on GitHub.
