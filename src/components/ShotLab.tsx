"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { PlayoffDataset } from "@/lib/types";
import { Scene1Client } from "@/components/scene1/Scene1Client";
import { Scene2Chart } from "@/components/scene2/Scene2Chart";

export function ShotLab({ data }: { data: PlayoffDataset }) {
  const [tab, setTab] = useState<"scene1" | "scene2">("scene1");

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b border-zinc-800 pb-2">
        <TabButton active={tab === "scene1"} onClick={() => setTab("scene1")}>
          Per-game 3D
        </TabButton>
        <TabButton active={tab === "scene2"} onClick={() => setTab("scene2")}>
          Full playoff
        </TabButton>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "scene1" ? <Scene1Client data={data} /> : <Scene2Chart data={data} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}
