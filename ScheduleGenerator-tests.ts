/**
 * ScheduleGenerator Test Cases
 *
 * Demonstrates manual scheduling of events and LLM-assisted scheduling of tasks + events
 */

import {
  ScheduleGenerator,
  formatTimeSlot,
  ScheduleResult,
  status,
  ScheduledBlock,
} from "./ScheduleGenerator";
import { GeminiLLM, Config } from "./gemini-llm";
import assert from "assert";

/**
 * Load configuration from config.json
 */
function loadConfig(): Config {
  try {
    const config = require("../config.json");
    return config;
  } catch (error) {
    console.error(
      "❌ Error loading config.json. Please ensure it exists with your API key."
    );
    console.error("Error details:", (error as Error).message);
    process.exit(1);
  }
}

function printSchedule(result: ScheduleResult): void {
  const slots: {
    [slot: number]: { type: string; name: string; duration: number }[];
  } = {};
  for (let i = 0; i < 48; i++) slots[i] = [];
  for (const block of result.blocks) {
    for (let i = 0; i < block.duration; i++) {
      const slot = block.startTime + i;
      if (slot < 48) {
        slots[slot].push({
          type: block.type,
          name: block.name,
          duration: block.duration,
        });
      }
    }
  }

  console.log("\n📅 Schedule of the Day");
  console.log("==================");
  let printedAny = false;
  for (let s = 0; s < 48; s++) {
    const items = slots[s];
    if (items.length === 0) continue;
    const isStart = items.some((it) =>
      result.blocks.find((b) => b.name === it.name && b.startTime === s)
    );
    if (isStart) {
      printedAny = true;
      const timeStr = formatTimeSlot(s);
      const uniqNames = [...new Set(items.map((i) => i.name))];
      for (const n of uniqNames) {
        const blk = result.blocks.find(
          (b) => b.name === n && b.startTime === s
        );
        if (!blk) continue;
        const durStr =
          blk.duration === 1 ? "30 min" : `${blk.duration * 0.5} hours`;
        console.log(`${timeStr} - ${n} (${durStr})`);
      }
    }
  }
  if (!printedAny) {
    console.log("No blocks scheduled.");
  }
}

/**
 * Test case 1: Events-only scheduling (no tasks)
 * Demonstrates adding events correctly assigns them to their defined slot by startTime and endTime
 */
export async function testEventsOnly(): Promise<void> {
  console.log("\n🧪 TEST CASE 1: Events Only");
  console.log("===========================");

  const gen = new ScheduleGenerator();
  const config = loadConfig();
  const llm = new GeminiLLM(config);

  console.log("📝 Adding fixed events...");
  gen.addEvent("Breakfast", 14, 15);
  gen.addEvent("Morning Workout", 16, 18);
  gen.addEvent("Team Meeting", 30, 32);

  const result = await gen.generateSchedule(llm);
  printSchedule(result);
}

/**
 * Test case 2: LLM-assisted scheduling
 * Demonstrates adding tasks only and letting the LLM assign them automatically
 */
export async function testLLMScheduling(): Promise<void> {
  console.log("\n🧪 TEST CASE 2: Tasks Only (LLM)");
  console.log("===============================");

  const gen = new ScheduleGenerator();
  const config = loadConfig();
  const llm = new GeminiLLM(config);

  console.log("📝 Adding tasks...");
  const now = new Date();
  gen.addTask(
    "Math Homework",
    new Date(now.getTime() + 6 * 60 * 60 * 1000),
    6,
    80
  ); // 2h
  gen.addTask(
    "Project Work",
    new Date(now.getTime() + 6 * 60 * 60 * 1000),
    6,
    70
  ); // 3h
  gen.addTask(
    "Gym Session",
    new Date(now.getTime() + 6 * 60 * 60 * 1000),
    6,
    50
  ); // 1h

  const result = await gen.generateSchedule(llm);
  let lastPriorty = result.blocks[0].priority;

  for (const block of result.blocks) {
    assert(
      block.priority <= lastPriorty,
      `${block.priority} has higher priority than ${lastPriorty}`
    );
    lastPriorty = block.priority;

    if (block.name !== "Gym Session")
      assert(
        block.startTime >= 10 && block.startTime <= 44,
        `${block.startTime} outside of time bounds`
      );
    else
      assert(
        block.startTime >= 12 && block.startTime <= 44,
        `${block.startTime} outside of time bounds`
      );
  }

  printSchedule(result);
}

/**
 * Test case 3: Mixed scheduling
 * Demonstrates adding events manually and tasks via LLM
 */
export async function testMixedScheduling(): Promise<void> {
  console.log("\n🧪 TEST CASE 3: Mixed (Events + Tasks)");
  console.log("====================================");

  const gen = new ScheduleGenerator();
  const config = loadConfig();
  const llm = new GeminiLLM(config);

  console.log("📝 Adding events and tasks...");
  gen.addEvent("Breakfast", 14, 15);
  gen.addEvent("Morning Workout", 16, 18);
  gen.addEvent("Team Meeting", 30, 32);

  const now = new Date();
  gen.addTask(
    "Study Session",
    new Date(now.getTime() + 7 * 60 * 60 * 1000),
    3,
    60
  ); // 1.5h
  gen.addTask(
    "Grab a Snack",
    new Date(now.getTime() + 7 * 60 * 60 * 1000),
    1,
    60
  ); // 1h
  gen.addTask(
    "Evening Reading",
    new Date(now.getTime() + 7 * 60 * 60 * 1000),
    2,
    60
  ); // 1h

  const result = await gen.generateSchedule(llm);

  for (const block of result.blocks) {
    const seenTasks = new Array<ScheduledBlock>();

    if (block.type === status.TASK) {
      if (!seenTasks.includes(block)) {
        const lastSeenTask =
          seenTasks[seenTasks.length - 1]?.completionTime ?? Number.MAX_VALUE;
        assert(
          block.completionTime <= lastSeenTask,
          `${block.completionTime} completion time > ${lastSeenTask}`
        );
        seenTasks.push(block);
      }
    }

    if (block.name !== "Morning Workout")
      assert(
        block.startTime >= 12 && block.startTime <= 44,
        `${block.startTime} outside of time bounds`
      );
    else
      assert(
        block.startTime >= 10 && block.startTime <= 44,
        `${block.startTime} outside of time bounds`
      );
  }

  printSchedule(result);
}

/**
 * Main function to run all test cases
 */
async function main(): Promise<void> {
  console.log("🎓 ScheduleGenerator Test Suite");
  console.log("===============================\n");

  try {
    // Run events-only test
    await testEventsOnly();

    // Run LLM scheduling test
    await testLLMScheduling();

    // Run mixed test
    await testMixedScheduling();

    console.log("\n🎉 All test cases completed successfully!");
  } catch (error) {
    console.error("❌ Test error:", (error as Error).message);
    process.exit(1);
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  main();
}
