"use client";

import {
  motion,
  type useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useState } from "react";

interface SkillPreview {
  id: string;
  title: string;
  color: string;
}

interface FolderData {
  category: string;
  slug: string;
  count: number;
  accentColor: string;
  position: { x: number; y: number };
  rotation: number;
  skills: SkillPreview[];
}

interface GlassFolderProps {
  folder: FolderData;
  onCategoryClick: (slug: string) => void;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}

export function GlassFolder({
  folder,
  onCategoryClick,
  mouseX,
  mouseY,
}: GlassFolderProps) {
  const [isHovered, setIsHovered] = useState(false);

  const offsetX = useTransform(
    mouseX,
    (v: number) => (v - 0.5) * (folder.position.x > 0 ? -15 : 15)
  );
  const offsetY = useTransform(mouseY, (v: number) => (v - 0.5) * -12);

  const springX = useSpring(offsetX, { stiffness: 80, damping: 30 });
  const springY = useSpring(offsetY, { stiffness: 80, damping: 30 });

  const folderWidth = 160;
  const folderHeight = 110;
  const cardWidth = 65;

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="pointer-events-auto absolute top-1/2 left-1/2 cursor-pointer"
      initial={{ opacity: 0, scale: 0.8 }}
      onClick={() => onCategoryClick(folder.slug)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        x: useTransform(
          springX,
          (v) => folder.position.x + v - folderWidth / 2
        ),
        y: useTransform(
          springY,
          (v) => folder.position.y + v - folderHeight / 2
        ),
      }}
      transition={{
        duration: 1,
        delay: Math.random() * 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <motion.div
        animate={{
          rotate: isHovered ? 0 : folder.rotation,
          scale: isHovered ? 1.08 : 1,
          y: isHovered ? -8 : 0,
        }}
        className="relative"
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
      >
        <div
          className="absolute"
          style={{ top: -10, left: folderWidth / 2 - cardWidth / 2 - 15 }}
        >
          {folder.skills.map((skill, idx) => (
            <SkillPreviewCard
              idx={idx}
              isHovered={isHovered}
              key={skill.id}
              skill={skill}
              totalCards={folder.skills.length}
            />
          ))}
        </div>

        <FolderSvg
          category={folder.category}
          folderHeight={folderHeight}
          folderWidth={folderWidth}
        />

        <motion.div
          animate={{ opacity: isHovered ? 1 : 0.8 }}
          className="mt-3 text-center"
        >
          <span className="font-medium text-foreground/80 text-sm">
            {folder.category}
          </span>
          <span className="ml-1.5 text-muted-foreground/50 text-xs">
            {folder.count}
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

interface SkillPreviewCardProps {
  skill: SkillPreview;
  idx: number;
  totalCards: number;
  isHovered: boolean;
}

function SkillPreviewCard({
  skill,
  idx,
  totalCards,
  isHovered,
}: SkillPreviewCardProps) {
  const centerIdx = (totalCards - 1) / 2;
  const offset = idx - centerIdx;
  const baseRotation = offset * 18;
  const baseX = offset * 22;
  const cardWidth = 65;
  const cardHeight = 50;

  return (
    <motion.div
      animate={{
        x: isHovered ? baseX * 1.6 : baseX * 0.5,
        y: isHovered ? -45 - Math.abs(offset) * 12 : -3,
        rotate: isHovered ? baseRotation * 1.2 : baseRotation * 0.2,
        scale: isHovered ? 1.1 : 0.85,
      }}
      className="absolute rounded-xl"
      style={{
        width: cardWidth,
        height: cardHeight,
        background: "var(--color-card)",
        boxShadow: isHovered
          ? "0 8px 24px -4px rgba(0,0,0,0.1), 0 4px 12px -2px rgba(0,0,0,0.1)"
          : "0 2px 8px -2px rgba(0,0,0,0.05), 0 4px 12px -4px rgba(0,0,0,0.05)",
        border: "1px solid var(--color-border)",
        zIndex: totalCards - Math.abs(Math.round(offset)),
        overflow: "hidden",
      }}
      transition={{
        type: "spring",
        stiffness: 280,
        damping: 22,
        delay: isHovered ? idx * 0.04 : (totalCards - 1 - idx) * 0.02,
      }}
    >
      <motion.div
        animate={{ height: isHovered ? 14 : 10 }}
        className="absolute top-0 right-0 left-0"
        style={{ background: skill.color }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      />
      <motion.div
        animate={{ opacity: isHovered ? 1 : 0.7 }}
        className="p-2 pt-4"
      >
        <div className="truncate font-medium text-[8px] text-foreground/70 leading-tight">
          {skill.title}
        </div>
      </motion.div>
      <motion.div
        animate={{ x: isHovered ? ["-100%", "200%"] : "-100%" }}
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)",
        }}
        transition={{ duration: 0.6, delay: idx * 0.05, ease: "easeOut" }}
      />
    </motion.div>
  );
}

interface FolderSvgProps {
  category: string;
  folderWidth: number;
  folderHeight: number;
}

function FolderSvg({ category, folderWidth, folderHeight }: FolderSvgProps) {
  return (
    <svg
      aria-label={`${category} folder`}
      className="relative z-10"
      height={folderHeight}
      role="img"
      style={{
        overflow: "visible",
        filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.1))",
      }}
      viewBox={`0 0 ${folderWidth} ${folderHeight}`}
      width={folderWidth}
    >
      <defs>
        <linearGradient
          id={`folder-glass-${category}`}
          x1="0%"
          x2="0%"
          y1="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="var(--color-card)" />
          <stop offset="100%" stopColor="var(--color-muted)" />
        </linearGradient>
        <linearGradient
          id={`folder-flap-${category}`}
          x1="0%"
          x2="0%"
          y1="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="var(--color-card)" />
          <stop offset="100%" stopColor="var(--color-muted)" />
        </linearGradient>
        <linearGradient
          id={`folder-shine-${category}`}
          x1="0%"
          x2="100%"
          y1="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="white" stopOpacity="0.1" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>

      <path
        d={`M 16 20 Q 16 12 24 12 L 45 12 Q 52 12 55 8 L 58 4 Q 61 0 68 0 L ${folderWidth - 16} 0 Q ${folderWidth} 0 ${folderWidth} 16 L ${folderWidth} ${folderHeight - 20} Q ${folderWidth} ${folderHeight} ${folderWidth - 20} ${folderHeight} L 20 ${folderHeight} Q 0 ${folderHeight} 0 ${folderHeight - 20} L 0 36 Q 0 20 16 20 Z`}
        fill={`url(#folder-glass-${category})`}
      />
      <path
        d={`M 6 45 Q 6 32 24 32 L ${folderWidth - 24} 32 Q ${folderWidth - 6} 32 ${folderWidth - 6} 45 L ${folderWidth - 6} ${folderHeight - 18} Q ${folderWidth - 6} ${folderHeight - 6} ${folderWidth - 18} ${folderHeight - 6} L 18 ${folderHeight - 6} Q 6 ${folderHeight - 6} 6 ${folderHeight - 18} Z`}
        fill={`url(#folder-flap-${category})`}
      />
      <path
        d={`M 6 45 Q 6 32 24 32 L ${folderWidth - 24} 32 Q ${folderWidth - 6} 32 ${folderWidth - 6} 45`}
        fill="none"
        stroke="var(--color-border)"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <path
        d={`M 16 20 Q 16 12 24 12 L 45 12 Q 52 12 55 8 L 58 4 Q 61 0 68 0 L ${folderWidth - 16} 0 Q ${folderWidth} 0 ${folderWidth} 16 L ${folderWidth} 30 L 0 50 L 0 36 Q 0 20 16 20 Z`}
        fill={`url(#folder-shine-${category})`}
      />
      <path
        d={`M 16 20 Q 16 12 24 12 L 45 12 Q 52 12 55 8 L 58 4 Q 61 0 68 0 L ${folderWidth - 16} 0 Q ${folderWidth} 0 ${folderWidth} 16 L ${folderWidth} ${folderHeight - 20} Q ${folderWidth} ${folderHeight} ${folderWidth - 20} ${folderHeight} L 20 ${folderHeight} Q 0 ${folderHeight} 0 ${folderHeight - 20} L 0 36 Q 0 20 16 20 Z`}
        fill="none"
        stroke="var(--color-border)"
        strokeOpacity="0.2"
        strokeWidth="1"
      />
    </svg>
  );
}

export const defaultFolders = [
  {
    category: "UI",
    slug: "ui",
    count: 24,
    accentColor: "#6366f1",
    position: { x: -340, y: -20 },
    rotation: -6,
    skills: [
      { id: "1", title: "State Management", color: "#818cf8" },
      { id: "2", title: "Design Systems", color: "#a78bfa" },
      { id: "3", title: "Accessibility", color: "#c4b5fd" },
    ],
  },
  {
    category: "Architecture",
    slug: "architecture",
    count: 18,
    accentColor: "#8b5cf6",
    position: { x: 340, y: -30 },
    rotation: 5,
    skills: [
      { id: "4", title: "Clean Code", color: "#a78bfa" },
      { id: "5", title: "Microservices", color: "#c4b5fd" },
      { id: "6", title: "Event Driven", color: "#ddd6fe" },
    ],
  },
  {
    category: "Performance",
    slug: "performance",
    count: 12,
    accentColor: "#ec4899",
    position: { x: -300, y: 150 },
    rotation: 4,
    skills: [
      { id: "7", title: "Caching", color: "#f9a8d4" },
      { id: "8", title: "Lazy Loading", color: "#fbcfe8" },
    ],
  },
  {
    category: "Testing",
    slug: "testing",
    count: 16,
    accentColor: "#f59e0b",
    position: { x: 320, y: 140 },
    rotation: -5,
    skills: [
      { id: "9", title: "Unit Testing", color: "#fcd34d" },
      { id: "10", title: "E2E Testing", color: "#fde68a" },
    ],
  },
];
