export type Story = {
  id: string;
  title: string;
  organization: string;
  role: string;
  situation: string;
  task: string;
  actions: string;
  result: string;
  source: "manual" | "resume";

  updatedAt: string;
};

export const storySections = [
  { key: "situation", label: "Situation", prompt: "What was happening? Describe the context and the problem." },
  { key: "task", label: "Task", prompt: "What were you personally responsible for achieving?" },
  { key: "actions", label: "Actions", prompt: "What did you do? Explain your decisions and individual contribution." },
  { key: "result", label: "Result", prompt: "What changed? Include an outcome or lesson, and metrics if you have them." },
] as const;

export function missingSections(story: Story) {
  return storySections.filter(({ key }) => !story[key].trim());
}

export function isStory(value: unknown): value is Story {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["id", "title", "organization", "role", "situation", "task", "actions", "result", "updatedAt"]
    .every((key) => typeof candidate[key] === "string")
    && (candidate.source === "manual" || candidate.source === "resume");

}

