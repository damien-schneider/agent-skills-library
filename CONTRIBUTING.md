# Contributing to Skills Agent Library

Thank you for your interest in contributing to the Skills Agent Library! This project is dedicated to building a high-quality repository of skills for AI agents.

## Code Standards

This project uses **Ultracite** to enforce strict code quality standards through automated formatting and linting (using Biome).

### Quick Commands

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

### Core Principles

- **Type Safety**: Use explicit types for function parameters and return values. Prefer `unknown` over `any`.
- **Modern TypeScript**: Use arrow functions, `for...of` loops, optional chaining, and template literals.
- **Async Code**: Always `await` promises in async functions. Use `try-catch` blocks for error handling.
- **React Standards**: Use function components and hooks. Specify all dependencies in hook arrays.
- **File Organization**: Keep files under 400 lines and functions focused.

## Development Workflow

1.  **Fork the repository**: Create your own copy of the project.
2.  **Install dependencies**:
    ```bash
    bun install
    ```
3.  **Setup Convex**:
    ```bash
    bun run dev:setup
    ```
4.  **Create a branch**:
    ```bash
    git checkout -b feature/your-feature-name
    ```
5.  **Develop**: Run the development server:
    ```bash
    bun run dev
    ```
6.  **Verify**: Ensure your code passes the quality checks:
    ```bash
    bun x ultracite check
    ```
7.  **Commit**: Use descriptive commit messages. Husky will run pre-commit hooks to ensure code quality.
8.  **Submit a Pull Request**: Provide a clear description of your changes and why they are needed.

## Style Guide

- Use meaningful variable names (avoid magic numbers).
- Use early returns to reduce nesting.
- Prefer simple conditionals over nested ternary operators.
- Group related code together and separate concerns.

## Testing

- Write assertions inside `it()` or `test()` blocks.
- Avoid done callbacks in async tests; use async/await instead.
- Do not include `.only` or `.skip` in committed code.

Thank you for helping us build a better library for AI agents!
