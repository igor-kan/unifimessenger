# Unifimessenger - AI-Powered Platform

## Project Overview
Universal multi-platform messenger with AI agents, CLI, and GUI support

## Technology Stack
- **Framework**: React
- **Language**: TypeScript
- **Runtime**: React 18.2.0
- **Routing**: React Router
- **Build Tool**: Webpack
- **Deployment**: GitHub Pages

## Key Features
- Modern responsive web application
- TypeScript for type safety

## Core Dependencies

## Development Commands
```bash
# Start production server
npm run start

# Development server
npm run dev

# Production build
npm run build

# Run tests
npm run test

# Lint code
npm run lint

```

## Project Structure
```
unifimessenger/
├── src/                     # Source code
└── package.json             # Dependencies
```

## Deployment
- **Platform**: GitHub Pages
- **URL**: https://github.com/unifimessenger/unifimessenger#readme
- **Build**: Static site generation
- **CI/CD**: Automated deployment via gh-pages

## Development Notes

## Testing & Quality
- TypeScript for type safety
- ESLint for code quality
- Jest for unit testing

## Future Enhancements
- Performance optimizations
- Advanced analytics integration
- Enhanced user experience features
- API integrations
- Mobile app development



## 🧭 Claude Code Navigation

### Quick Commands
**Development Scripts:**
- `start`: node src/index.js
- `dev`: nodemon src/index.js
- `build`: npm run build:gui
- `test`: jest
- `lint`: eslint src/ --ext .js,.jsx,.ts,.tsx

**Key Files:**
- `package.json` - Dependencies and scripts configuration
- `README.md` - Project documentation and setup guide
- `CLAUDE.md` - Comprehensive development guide for Claude

**Key Directories:**
- `src/` - Source code and main application logic

**Claude Code Files:**
- `.claude/project-context.md` - Project overview and structure
- `.claude/coding-standards.md` - Development guidelines and patterns
- `.claude/commands/` - Custom Claude commands for common tasks
- `.claude/context/` - Domain-specific development context


### Quick Reference

**Common Tasks:**
- Start development: `npm run dev` or `bun dev`
- Build project: `npm run build` or `bun build`
- Run tests: `npm run test` or `bun test`
- Lint code: `npm run lint` or `bun lint`

**File Patterns:**
- Components: `components/**/*.tsx`
- Pages: `app/**/*.tsx` or `pages/**/*.tsx`
- Utilities: `lib/**/*.ts`
- Styles: `**/*.css` or use Tailwind classes
- Tests: `**/*.test.ts` or `**/*.spec.ts`

**Development Tips:**
- Use TypeScript for type safety
- Follow existing component patterns
- Utilize shadcn/ui components
- Implement responsive design with Tailwind
- Test changes before committing

