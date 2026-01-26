"use client";

import {
  motion,
  type useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";

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
  onCategoryClick: (slug: string, categoryName: string) => void;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}

export function GlassFolder({
  folder,
  onCategoryClick,
  mouseX,
  mouseY,
}: GlassFolderProps) {
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
    <>
      <style>{`
        .group:hover [data-skill-card] {
          transform: var(--hover-transform) !important;
          box-shadow: var(--hover-shadow) !important;
        }
      `}</style>
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="group pointer-events-auto absolute top-1/2 left-1/2 cursor-pointer"
        initial={{ opacity: 0, scale: 0.8 }}
        onClick={() => onCategoryClick(folder.slug, folder.category)}
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
        <div
          className="relative transform-gpu transition-transform duration-300 ease-out will-change-transform group-hover:-translate-y-2 group-hover:rotate-0 group-hover:scale-[1.08]"
          style={{
            transform: `rotate(${folder.rotation}deg)`,
          }}
        >
          <div
            className="absolute"
            style={{ top: -10, left: folderWidth / 2 - cardWidth / 2 - 15 }}
          >
            {folder.skills.map((skill, idx) => (
              <SkillPreviewCard
                idx={idx}
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

          <div className="mt-3 text-center opacity-80 group-hover:opacity-100">
            <span className="font-medium text-foreground/80 text-sm">
              {folder.category}
            </span>
            <span className="ml-1.5 text-muted-foreground/50 text-xs">
              {folder.count}
            </span>
          </div>
        </div>
      </motion.div>
    </>
  );
}

interface SkillPreviewCardProps {
  skill: SkillPreview;
  idx: number;
  totalCards: number;
}

function SkillPreviewCard({ skill, idx, totalCards }: SkillPreviewCardProps) {
  const centerIdx = (totalCards - 1) / 2;
  const offset = idx - centerIdx;
  const baseRotation = offset * 18;
  const baseX = offset * 22;
  const cardWidth = 65;
  const cardHeight = 50;

  const baseTransformX = baseX * 0.5;
  const baseTransformY = -3;
  const baseTransformRotate = baseRotation * 0.2;
  const hoverTransformX = baseX * 1.6;
  const hoverTransformY = -45 - Math.abs(offset) * 12;
  const hoverTransformRotate = baseRotation * 1.2;

  return (
    <div
      className="absolute rounded-xl transition-transform duration-300 ease-out will-change-transform"
      data-skill-card
      style={
        {
          width: cardWidth,
          height: cardHeight,
          background: "var(--color-card)",
          border: "1px solid var(--color-border)",
          zIndex: totalCards - Math.abs(Math.round(offset)),
          overflow: "hidden",
          transform: `translate(${baseTransformX}px, ${baseTransformY}px) rotate(${baseTransformRotate}deg) scale(0.85)`,
          boxShadow:
            "0 2px 8px -2px rgba(0,0,0,0.05), 0 4px 12px -4px rgba(0,0,0,0.05)",
          "--hover-transform": `translate(${hoverTransformX}px, ${hoverTransformY}px) rotate(${hoverTransformRotate}deg) scale(1.1)`,
          "--hover-shadow":
            "0 8px 24px -4px rgba(0,0,0,0.1), 0 4px 12px -2px rgba(0,0,0,0.1)",
        } as React.CSSProperties & {
          "--hover-transform": string;
          "--hover-shadow": string;
        }
      }
    >
      <div
        className="absolute top-0 right-0 left-0 h-[10px] transition-[height] duration-300 ease-out group-hover:h-[14px]"
        style={{ background: skill.color }}
      />
      <div className="p-2 pt-4 opacity-70 transition-opacity duration-300 group-hover:opacity-100">
        <div className="truncate font-medium text-[8px] text-foreground/70 leading-tight">
          {skill.title}
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full transform-gpu transition-transform duration-600 ease-out group-hover:translate-x-[200%]"
        style={{
          background:
            "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)",
          transitionDelay: `${idx * 50}ms`,
        }}
      />
    </div>
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
        filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.08))",
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
