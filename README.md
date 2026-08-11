# Skills Agent Library

[agents-library.dev](https://agents-library.dev)

A modern platform for discovering, sharing, and managing high-quality skills for AI agents.

## 🖥️ Desktop App

[![Download for macOS](https://img.shields.io/github/v/release/damien-schneider/agent-skills-library?label=Download%20for%20macOS&style=for-the-badge&logo=apple&color=black)](https://github.com/damien-schneider/agent-skills-library/releases/latest/download/agents-library_universal.dmg)

Browse, deduplicate and sync the skills scattered across your machine — Claude skills and agents, Cursor rules, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`. Universal binary for Apple Silicon and Intel, signed and notarized by Apple, with built-in automatic updates.

## 🚀 The Hub for Agent Capabilities

The **Skills Agent Library** is a centralized ecosystem dedicated to expanding what AI agents can do. It provides a structured, community-driven repository of markdown-based skills that enable agents to execute complex workflows, interact with various tools, and master specific domain knowledge.

## ✨ Core Features

- **🔍 Discover & Explore**: Find the perfect skill for your agent through intuitive categorization, tagging, and powerful search.
- **🗳️ Community Trust**: A robust voting system ensures the most effective skills rise to the top, providing reliability for your agent deployments.
- **🤖 Automated Quality Assessment**: Every skill is analyzed by AI to score its clarity, usefulness, and completeness.
- **📦 Effortless GitHub Integration**: Import and sync skill definitions directly from GitHub repositories to keep your library up to date.
- **⚡ Real-time Updates**: Experience a live, reactive library where new skills and improvements are reflected instantly.
- **📱 Accessible Anywhere**: A fully responsive interface that works seamlessly on desktop and mobile, also available as an installable web app.

## 🏗️ Project Structure

```text
.
├── apps/
│   ├── web/           # Frontend application & user interface
│   └── desktop/       # macOS app (Tauri) for managing local skills
├── packages/
│   ├── backend/       # Real-time data management & business logic
│   ├── skills-core/   # Skill parsing & target detection, shared by web and desktop
│   ├── config/        # Environment and workspace configurations
│   └── env/           # Secure environment variable management
└── AGENTS.md          # AI agent specific usage instructions
```

## 🏁 Development Setup

### Prerequisites

- [Bun](https://bun.sh)
- [Convex](https://convex.dev) account

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/damien-schneider/agent-skills-library.git
    cd agent-skills-library
    ```

2.  **Install dependencies**:
    ```bash
    bun install
    ```

3.  **Setup Backend**:
    ```bash
    bun run dev:setup
    ```

4.  **Run locally**:
    ```bash
    bun run dev
    ```

Visit [http://localhost:3020](http://localhost:3020) to see your local instance.

## 📜 Repository Scripts

- `bun run dev`: Start development mode.
- `bun run build`: Create a production build.
- `bun run check-types`: Validate TypeScript types.
- `bun x ultracite fix`: Format and lint the codebase.

## 🤝 Contributing

Join us in building the largest library of agent skills! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
