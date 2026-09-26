import { getSupabase } from "./supabase";
import { isStory, type Story } from "./story";

export const LOCAL_STORIES_KEY = "hackgt.story-bank.v1";
export function readLocalStories(): Story[] {
  const raw = localStorage.getItem(LOCAL_STORIES_KEY);
  const value: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(value) || !value.every(isStory)) {
    throw new Error("Browser stories could not be read. Existing data has been preserved.");
  }
  return value.map((story) => ({ id: story.id, title: story.title, organization: story.organization, role: story.role, situation: story.situation, task: story.task, actions: story.actions, result: story.result, source: story.source, updatedAt: story.updatedAt }));
}

export function toRow(story: Story, ownerId: string) {
  return {
    id: story.id, owner_id: ownerId, title: story.title.trim(),
    organization: story.organization, role: story.role,
    situation: story.situation, task: story.task, actions: story.actions,
    result: story.result, source: story.source,
  };
}

export function fromRow(row: Record<string, unknown>): Story {
  const story = {
    id: row.id, title: row.title, organization: row.organization, role: row.role,
    situation: row.situation, task: row.task, actions: row.actions, result: row.result,
    source: row.source, updatedAt: row.updated_at,
  };
  if (!isStory(story)) throw new Error("Unexpected story data received from the database.");
  return story;
}

export async function listStories(ownerId: string) {
  const { data, error } = await getSupabase().from("stories").select("*")
    .eq("owner_id", ownerId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data.map(fromRow);
}

export async function saveStory(story: Story, ownerId: string, exists: boolean) {
  const table = getSupabase().from("stories");
  // Update only the edited record. Never replace the entire user's collection.
  const query = exists
    ? table.update(toRow(story, ownerId)).eq("id", story.id).eq("owner_id", ownerId)
    : table.insert(toRow(story, ownerId));
  const { data, error } = await query.select("*").single();
  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function deleteStory(id: string, ownerId: string) {
  const { data, error } = await getSupabase().from("stories").delete()
    .eq("id", id).eq("owner_id", ownerId).select("id").single();
  if (error || !data) throw new Error(error?.message || "Story was not deleted. Reload and try again.");
}

export async function importLocalStories(ownerId: string) {
  const stories = readLocalStories();
  if (!stories.length) return 0;
  if (stories.some((story) => !story.title.trim() || story.title.trim().length > 160)) {
    throw new Error("Every browser story needs a title of 1–160 characters before import.");
  }
  // Idempotent import: repeat clicks never overwrite a newer cloud edit.
  const { data, error } = await getSupabase().from("stories")
    .upsert(stories.map((story) => toRow(story, ownerId)), { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return data.length;
}

