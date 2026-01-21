# Skills Agent Library - Frontend

This is the web application for [agents-library.dev](https://agents-library.dev), built to provide a seamless interface for discovering and managing AI agent skills.

## 🎨 Design Goals

- **Focus on Clarity**: Markdown-heavy content is rendered with optimal readability for both human review and agent consumption.
- **Fluid Discovery**: High-performance search and filtering allow users to find skills quickly.
- **Reactive UI**: Leveraging Convex's real-time capabilities to provide instant feedback on votes, imports, and scoring.

## 📁 Key Features in `src/`

- **`features/skills`**: The core logic and components for skill management, including:
  - Markdown editor/viewer for skill content.
  - GitHub import workflows.
  - Scoring visualizations.
  - Voting components.
- **`features/auth`**: User authentication and profile management using Better-Auth.
- **`shared/ui`**: A consistent design system built on TailwindCSS and shadcn/ui.

## 🚀 Running Locally

From the project root:
```bash
bun run dev:web
```

The app will be available at [http://localhost:3020](http://localhost:3020).
