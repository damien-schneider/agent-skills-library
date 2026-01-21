import { mutation } from "./_generated/server";

export const seedCategories = mutation({
  handler: async (ctx) => {
    const existingCategories = await ctx.db.query("categories").collect();
    if (existingCategories.length > 0) {
      return {
        message: "Categories already seeded",
        count: existingCategories.length,
      };
    }

    const categories = [
      { name: "UI", slug: "ui", color: "oklch(0.65 0.18 240)", skillCount: 0 },
      {
        name: "Architecture",
        slug: "architecture",
        color: "oklch(0.7 0.18 30)",
        skillCount: 0,
      },
      {
        name: "Code Quality",
        slug: "code-quality",
        color: "oklch(0.7 0.16 145)",
        skillCount: 0,
      },
      {
        name: "Testing",
        slug: "testing",
        color: "oklch(0.8 0.16 80)",
        skillCount: 0,
      },
      {
        name: "Performance",
        slug: "performance",
        color: "oklch(0.65 0.2 300)",
        skillCount: 0,
      },
      {
        name: "Security",
        slug: "security",
        color: "oklch(0.7 0.14 185)",
        skillCount: 0,
      },
    ];

    for (const category of categories) {
      await ctx.db.insert("categories", category);
    }

    return {
      message: "Categories seeded successfully",
      count: categories.length,
    };
  },
});

export const seedSampleSkills = mutation({
  handler: async (ctx) => {
    const existingSkills = await ctx.db.query("skills").collect();
    if (existingSkills.length > 0) {
      return { message: "Skills already seeded", count: existingSkills.length };
    }

    const skillColors = [
      "oklch(0.92 0.08 100)",
      "oklch(0.90 0.10 145)",
      "oklch(0.90 0.08 300)",
      "oklch(0.92 0.10 30)",
      "oklch(0.88 0.10 220)",
      "oklch(0.90 0.08 180)",
    ];

    const sampleSkills = [
      {
        name: "Component Architecture Patterns",
        description:
          "Best practices for structuring React components with proper separation of concerns and reusability patterns.",
        category: "architecture",
        authorId: "system",
        authorName: "Sarah Chen",
        markdown: `# Component Architecture Patterns

## Overview
This skill covers best practices for structuring React components.

## Key Principles
1. **Single Responsibility**: Each component should do one thing well
2. **Composition over Inheritance**: Use composition patterns
3. **Prop Drilling Prevention**: Use context or state management

## Example
\`\`\`tsx
// Good: Composable component
function Card({ children, header, footer }) {
  return (
    <div className="card">
      {header && <CardHeader>{header}</CardHeader>}
      <CardBody>{children}</CardBody>
      {footer && <CardFooter>{footer}</CardFooter>}
    </div>
  )
}
\`\`\``,
        tags: ["react", "architecture", "patterns"],
        color: skillColors[0],
        aiScore: { overall: 92, clarity: 95, usefulness: 90, completeness: 88 },
      },
      {
        name: "Accessible Form Validation",
        description:
          "Implementing form validation with proper ARIA attributes and screen reader announcements.",
        category: "ui",
        authorId: "system",
        authorName: "Marcus Johnson",
        markdown: `# Accessible Form Validation

## Overview
Create forms that work for everyone with proper accessibility.

## Key Features
- Live region announcements for errors
- Proper label associations
- Focus management on submission

## Implementation
\`\`\`tsx
function FormField({ error, label, id }) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-describedby={\`\${id}-error\`}
        aria-invalid={!!error}
      />
      {error && (
        <span id={\`\${id}-error\`} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
\`\`\``,
        tags: ["accessibility", "forms", "a11y"],
        color: skillColors[1],
        aiScore: { overall: 88, clarity: 90, usefulness: 92, completeness: 82 },
      },
      {
        name: "Unit Testing React Hooks",
        description:
          "Comprehensive guide to testing custom React hooks with proper isolation and edge case coverage.",
        category: "testing",
        authorId: "system",
        authorName: "Elena Rodriguez",
        markdown: `# Unit Testing React Hooks

## Overview
Learn to test custom hooks effectively with React Testing Library.

## Setup
\`\`\`tsx
import { renderHook, act } from '@testing-library/react'
import { useCounter } from './useCounter'

describe('useCounter', () => {
  it('increments counter', () => {
    const { result } = renderHook(() => useCounter())

    act(() => {
      result.current.increment()
    })

    expect(result.current.count).toBe(1)
  })
})
\`\`\``,
        tags: ["testing", "hooks", "react"],
        color: skillColors[2],
        aiScore: { overall: 85, clarity: 88, usefulness: 85, completeness: 80 },
      },
      {
        name: "Performance Optimization Checklist",
        description:
          "A systematic approach to identifying and fixing performance bottlenecks in React applications.",
        category: "performance",
        authorId: "system",
        authorName: "David Kim",
        markdown: `# Performance Optimization Checklist

## Quick Wins
- [ ] Implement React.memo for expensive components
- [ ] Use useMemo/useCallback appropriately
- [ ] Lazy load routes and heavy components
- [ ] Optimize images and assets

## Advanced
- [ ] Profile with React DevTools
- [ ] Implement virtualization for long lists
- [ ] Code split vendor bundles`,
        tags: ["performance", "optimization", "react"],
        color: skillColors[3],
        aiScore: { overall: 94, clarity: 96, usefulness: 95, completeness: 90 },
      },
      {
        name: "CSS-in-JS Best Practices",
        description:
          "Guidelines for writing maintainable and performant CSS-in-JS with styled-components or emotion.",
        category: "ui",
        authorId: "system",
        authorName: "Amanda Foster",
        markdown: `# CSS-in-JS Best Practices

## Principles
1. Co-locate styles with components
2. Use design tokens for consistency
3. Avoid inline style objects in render

## Example
\`\`\`tsx
const Button = styled.button\`
  padding: \${({ theme }) => theme.spacing.md};
  background: \${({ variant, theme }) =>
    variant === 'primary' ? theme.colors.primary : 'transparent'};
\`
\`\`\``,
        tags: ["css", "styling", "best-practices"],
        color: skillColors[4],
        aiScore: { overall: 82, clarity: 85, usefulness: 80, completeness: 78 },
      },
      {
        name: "Security Headers Configuration",
        description:
          "Essential HTTP security headers every web application should implement for protection.",
        category: "security",
        authorId: "system",
        authorName: "James Wilson",
        markdown: `# Security Headers Configuration

## Essential Headers
\`\`\`javascript
// next.config.js
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'"
  }
]
\`\`\``,
        tags: ["security", "headers", "configuration"],
        color: skillColors[5],
        aiScore: { overall: 91, clarity: 92, usefulness: 94, completeness: 86 },
      },
    ];

    const categoryCountMap: Record<string, number> = {};

    for (const skill of sampleSkills) {
      await ctx.db.insert("skills", skill);
      categoryCountMap[skill.category] =
        (categoryCountMap[skill.category] || 0) + 1;
    }

    const categories = await ctx.db.query("categories").collect();
    for (const category of categories) {
      const count = categoryCountMap[category.slug] || 0;
      if (count > 0) {
        await ctx.db.patch(category._id, { skillCount: count });
      }
    }

    return {
      message: "Sample skills seeded successfully",
      count: sampleSkills.length,
    };
  },
});

export const clearAll = mutation({
  handler: async (ctx) => {
    const skills = await ctx.db.query("skills").collect();
    for (const skill of skills) {
      await ctx.db.delete(skill._id);
    }

    const categories = await ctx.db.query("categories").collect();
    for (const category of categories) {
      await ctx.db.delete(category._id);
    }

    const votes = await ctx.db.query("votes").collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    return { message: "All data cleared" };
  },
});
