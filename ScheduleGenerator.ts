/**
 * (Simple) ScheduleGenerator implementation for Taskmate
 * - addEvent, editEvent, deleteEvent, addTask, editTask, deleteTask
 * - generateSchedule (LLM action)
 * - owner and schedulePointer attributes and set of Schedule state is omitted
 * - Time is represented as half-hour slots from 0 to 47 in a single day, like in Prep 2
 */

import { GeminiLLM } from "./gemini-llm";

export interface Event {
  name: string;
  startTime: number; // half-hour slot 0 to 47
  endTime: number; // exclusive half-hour slot 1 to 48
  repeatTime?: string; // temporary for now
}

export interface Task {
  name: string;
  deadline: Date;
  expectedCompletionTime: number; // half-hour slots
  completionLevel: number; // a percent 0 to 100
  priority: number; // a percent 0 to 100
}

export interface ScheduledBlock {
  name: string; // event/task name
  startTime: number; // half-hour slot
  duration: number; // number of slots
  type: status.EVENT | status.TASK;
  priority: number; // a percent 0 to 100
  completionTime: number; // half-hour slot when the block is completed
}

export interface ScheduleResult {
  timestamp: number;
  blocks: ScheduledBlock[];
}

export enum status {
  FREE = "free",
  EVENT = "event",
  TASK = "task",
}

export class ScheduleGenerator {
  private events: Event[] = [];
  private tasks: Task[] = [];
  private timestamp = 0;

  addEvent(
    name: string,
    startTime: number,
    endTime: number,
    repeatTime?: string
  ): Event {
    const event: Event = { name, startTime, endTime, repeatTime };
    this.events.push(event);
    return event;
  }

  editEvent(
    oldEvent: Event,
    name: string,
    startTime: number,
    endTime: number,
    repeatTime?: string
  ): void {
    const index = this.events.indexOf(oldEvent);
    if (index === -1) throw new Error("Event not found in schedule");
    this.events[index] = { name, startTime, endTime, repeatTime };
  }

  deleteEvent(event: Event): void {
    const index = this.events.indexOf(event);
    if (index === -1) throw new Error("Event not found in schedule");
    this.events.splice(index, 1);
  }

  addTask(
    name: string,
    deadline: Date,
    expectedCompletionTime: number,
    priority: number
  ): Task {
    const task: Task = {
      name,
      deadline,
      expectedCompletionTime,
      completionLevel: 0,
      priority,
    };
    this.tasks.push(task);
    return task;
  }

  editTask(
    oldTask: Task,
    name: string,
    deadline: Date,
    expectedCompletionTime: number,
    completionLevel: number,
    priority: number
  ): void {
    const index = this.tasks.indexOf(oldTask);
    if (index === -1) throw new Error("Task not found in schedule");
    this.tasks[index] = {
      name,
      deadline,
      expectedCompletionTime,
      completionLevel,
      priority,
    };
  }

  deleteTask(task: Task): void {
    const index = this.tasks.indexOf(task);
    if (index === -1) throw new Error("Task not found in schedule");
    this.tasks.splice(index, 1);
  }

  /**
   * Current implementation places all events at their fixed times and schedules remaining tasks
   * into remaining free slots, ordered by (sooner deadline, higher priority, greater expected completion time)
   * The llm parameter is accepted for API compatibility but not used by the MVP.
   */
  async generateSchedule(llm: GeminiLLM): Promise<ScheduleResult> {
    // Build occupied map from events
    const occupied = new Array<status>(48).fill(status.FREE);
    const blocks: ScheduledBlock[] = [];

    // Place events (validate bounds and conflicts among events)
    const sortedEvents = [...this.events].sort(
      (a, b) => a.startTime - b.startTime
    );
    for (const event of sortedEvents) {
      if (
        !Number.isInteger(event.startTime) ||
        !Number.isInteger(event.endTime) ||
        event.startTime < 0 ||
        event.endTime > 48 ||
        event.endTime <= event.startTime
      ) {
        throw new Error(`Event ${event.name} has invalid time bounds`);
      }
      for (let t = event.startTime; t < event.endTime; t++) {
        if (occupied[t] !== "free") {
          throw new Error(
            `Event ${event.name} conflicts with another event at slot ${t}`
          );
        }
      }
      for (let t = event.startTime; t < event.endTime; t++)
        occupied[t] = status.EVENT;
      blocks.push({
        name: event.name,
        startTime: event.startTime,
        duration: event.endTime - event.startTime,
        type: status.EVENT,
        priority: 50, // default priority
        completionTime: event.endTime,
      });
    }

    // Build prompt and request assignments from Gemini for tasks
    const prompt = this.createSchedulePrompt(blocks, this.tasks);

    // Retry mechanism for invalid LLM responses
    let maxRetries = 1;
    let retryCount = 0;
    let responseText: string;

    while (retryCount < maxRetries) {
      try {
        responseText = await llm.executeLLM(prompt);
        // Apply LLM-proposed task blocks with validation against fixed event occupancy
        this.applyTaskAssignmentsFromLLM(
          responseText,
          occupied,
          blocks,
          this.tasks
        );
        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error(
            `LLM failed to provide valid assignments after ${maxRetries} attempts. Last error: ${
              (error as Error).message
            }`
          );
        }
        console.log(
          `⚠️  LLM provided invalid assignments (attempt ${retryCount}/${maxRetries}), retrying...`
        );
      }
    }

    this.timestamp += 1;
    // Normalize/merge adjacent blocks with same label and type
    const merged = mergeAdjacentBlocks(blocks);
    return {
      timestamp: this.timestamp,
      blocks: merged.sort((a, b) => b.priority - a.priority), // Sort by priority descending
    };
  }
  /**
   * Build a structured prompt for Gemini to schedule tasks around fixed events.
   * The response must be a JSON object: { "assignments": [ { "task": string, "startTime": number, "duration": number } ] }
   */
  private createSchedulePrompt(
    eventBlocks: ScheduledBlock[],
    tasks: Task[]
  ): string {
    const fixedEvents = eventBlocks
      .filter((b) => b.type === status.EVENT)
      .map((b) => ({
        name: b.name,
        startTime: b.startTime,
        endTime: b.startTime + b.duration,
      }));
    const taskList = tasks.map((t) => ({
      name: t.name,
      expectedCompletionTime: t.expectedCompletionTime,
      priority: t.priority,
      // Use epoch ms for clarity
      deadlineMs: t.deadline.getTime(),
    }));

    const fixedSection = JSON.stringify(fixedEvents, null, 2);
    const tasksSection = JSON.stringify(taskList, null, 2);

    return `You are a helpful scheduling assistant. Time is split into 48 half-hour slots (0 to 47).
    Fixed events cannot be moved or overlapped. Schedule the tasks into remaining free slots.

    Return ONLY valid JSON with this exact structure and keys:
    {
      "assignments": [
        { "task": string, "startTime": number, "duration": number }
      ]
    }

    TIME SYSTEM:
      - Times are represented in half-hour slots starting at midnight
      - Slot 0 = 12:00 AM, Slot 13 = 6:30 AM, Slot 26 = 1:00 PM, Slot 38 = 7:00 PM, etc.
      - There are 48 slots total (24 hours x 2)
      - Valid slots are 0-47 (midnight to 11:30 PM)

    HARD CONSTRAINTS:
    - Do not overlap any tasks with each other or with fixed events.
    - Do not overlap multiple blocks of the same task with each other.
    - duration must be >= 1 and sum of durations per task should be <= expectedCompletionTime for that task.
    - You may split a task into multiple blocks, but each block must be in a separate, non-overlapping time slot.
    - Consider tasks with sooner deadlines, higher priority, and greater completionTimes to be scheduled earlier than tasks with later deadlines, lower priority, and smaller completionTimes.

    STUDENT PREFERENCES:
    - Avoid scheduling activities too late at night (after slot 44) or too early in the morning (before slot 12)
    - Exercise activities work well in the morning (slots 12 to 20) and at night (slots 36 to 42)
    - Classes and study time should be scheduled during focused hours (slots 18 to 42)
    - Meals should be at regular intervals (breakfast: slots 14 to 18, lunch: slots 24 to 26, dinner: slots 36 to 40)
    - Social activities and relaxation are good for evenings (slots 36 to 42)
    - Try to buffer time between different types of activities

    FIXED_EVENTS:
    ${fixedSection}

    TASKS:
    ${tasksSection}`;
  }

  /**
   * Parse LLM response and place task blocks while validating bounds and conflicts.
   */
  private applyTaskAssignmentsFromLLM(
    responseText: string,
    occupied: Array<status>,
    blocks: ScheduledBlock[],
    tasks: Task[]
  ): void {
    // Extract JSON object from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in LLM response");
    const data = JSON.parse(jsonMatch[0]);
    if (!data || !Array.isArray(data.assignments)) {
      throw new Error("Invalid LLM response: missing assignments[]");
    }

    const taskByName = new Map<string, Task[]>();
    for (const t of tasks) {
      const list = taskByName.get(t.name) ?? [];
      list.push(t);
      taskByName.set(t.name, list);
    }

    // Track how much of each task we have scheduled so far
    const scheduledSoFar = new Map<string, number>();

    // Track occupied slots including task assignments from this LLM response
    const currentOccupied = [...occupied];

    const issues: string[] = [];
    const validated: {
      taskName: string;
      startTime: number;
      duration: number;
    }[] = [];

    for (const entry of data.assignments) {
      if (!entry || typeof entry !== "object") {
        issues.push("Non-object assignment entry");
        continue;
      }
      const { task, startTime, duration } = entry as {
        task?: unknown;
        startTime?: unknown;
        duration?: unknown;
      };
      if (typeof task !== "string" || task.trim() === "") {
        issues.push("Assignment missing task name");
        continue;
      }
      if (
        !Number.isInteger(startTime as number) ||
        !Number.isInteger(duration as number)
      ) {
        issues.push(`Assignment for ${task} has non-integer times`);
        continue;
      }
      const s = startTime as number;
      const d = duration as number;
      if (s < 0 || s > 47) {
        issues.push(`Start out of range for ${task}`);
        continue;
      }
      if (d <= 0) {
        issues.push(`Non-positive duration for ${task}`);
        continue;
      }
      if (s + d > 48) {
        issues.push(`Block exceeds day for ${task}`);
        continue;
      }

      // ensure task exists
      const pool = taskByName.get(task);
      if (!pool || pool.length === 0) {
        issues.push(`Unknown task ${task}`);
        continue;
      }

      // ensure slots free
      let conflict = false;
      for (let t = s; t < s + d; t++) {
        if (currentOccupied[t] !== status.FREE) {
          conflict = true;
          break;
        }
      }
      if (conflict) {
        issues.push(`Block for ${task} overlaps an occupied slot`);
        continue;
      }

      // limit by remaining expected time
      const expected = pool[0].expectedCompletionTime | 0;
      const used = scheduledSoFar.get(task) ?? 0;
      const remaining = Math.max(0, expected - used);
      if (remaining <= 0) {
        continue;
      }
      const place = Math.min(remaining, d);

      // reserve slots
      for (let t = s; t < s + place; t++) currentOccupied[t] = status.TASK;
      scheduledSoFar.set(task, used + place);
      validated.push({ taskName: task, startTime: s, duration: place });
    }

    if (issues.length > 0) {
      throw new Error(
        `LLM provided invalid assignments:\n- ${issues.join("\n- ")}`
      );
    }

    for (const v of validated) {
      // Find the original task to get its priority
      const originalTask = tasks.find((t) => t.name === v.taskName);
      const taskPriority = originalTask ? originalTask.priority : 50; // fallback to 50 if task not found

      blocks.push({
        name: v.taskName,
        startTime: v.startTime,
        duration: v.duration,
        type: status.TASK,
        priority: taskPriority,
        completionTime: v.startTime + v.duration,
      });
    }
  }
}

function mergeAdjacentBlocks(blocks: ScheduledBlock[]): ScheduledBlock[] {
  const byStart = [...blocks].sort((a, b) => a.startTime - b.startTime);
  const out: ScheduledBlock[] = [];
  for (const b of byStart) {
    const last = out[out.length - 1];
    if (
      last &&
      last.type === b.type &&
      last.name === b.name &&
      last.priority === b.priority &&
      last.startTime + last.duration === b.startTime
    ) {
      last.duration += b.duration;
      last.completionTime = last.startTime + last.duration;
    } else {
      out.push({ ...b });
    }
  }
  return out;
}

// Small helpers (kept for potential debugging/printing during development)
export function formatTimeSlot(timeSlot: number): string {
  const hours = Math.floor(timeSlot / 2);
  const minutes = (timeSlot % 2) * 30;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}
