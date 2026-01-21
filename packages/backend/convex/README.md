# Skills Agent Library - Backend

This directory contains the [Convex](https://convex.dev) schema and functions that power [agents-library.dev](https://agents-library.dev).

## 📊 Core Data Model

- **`skills`**: The primary entity storing markdown content, metadata (license, compatibility), and AI/Community scores.
- **`categories`**: Groupings for skills (e.g., "Productivity", "Development", "Research").
- **`votes`**: Tracking of community sentiment (upvotes/downvotes).
- **`savedSkills`**: User-specific collections of bookmarked skills.

## 🛠️ Key Functionality

- **Live Queries**: Highly reactive data fetching for real-time library updates.
- **Mutations**: Atomic operations for voting, saving, and updating skill content.
- **Background Actions**: Integration with external services (like GitHub) for data ingestion and AI scoring.

## 🚀 Running Locally

From the project root:
```bash
bun run dev:server
```

This will start the Convex development environment and sync your local schema and functions.
