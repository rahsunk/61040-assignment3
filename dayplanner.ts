/**
 * DayPlanner Concept - AI Augmented Version
 */

import { GeminiLLM } from "./gemini-llm";

// A single activity that can be scheduled
export interface Activity {
  title: string;
  duration: number; // in half-hour increments
}

// An assignment of an activity to a time slot
export interface Assignment {
  activity: Activity;
  startTime: number; // in half-hour slots from midnight
}

export class DayPlanner {
  private activities: Activity[] = [];
  private assignments: Assignment[] = [];

  addActivity(title: string, duration: number): Activity {
    const activity: Activity = {
      title,
      duration,
    };
    this.activities.push(activity);
    return activity;
  }

  removeActivity(activity: Activity): void {
    // Remove assignments for this activity
    this.assignments = this.assignments.filter(
      (assignment) => assignment.activity !== activity
    );

    // Remove the activity
    this.activities = this.activities.filter((a) => a !== activity);
  }

  assignActivity(activity: Activity, startTime: number): void {
    // Remove any existing assignment for this activity
    this.unassignActivity(activity);

    // Create new assignment
    const assignment: Assignment = {
      activity,
      startTime,
    };

    this.assignments.push(assignment);
  }

  unassignActivity(activity: Activity): void {
    this.assignments = this.assignments.filter(
      (assignment) => assignment.activity !== activity
    );
  }

  async assignActivities(llm: GeminiLLM): Promise<void> {
    try {
      console.log("🤖 Requesting schedule assignments from Gemini AI...");

      const unassignedActivities = this.activities.filter(
        (a) => !this.isAssigned(a)
      );

      if (unassignedActivities.length === 0) {
        console.log("✅ All activities are already assigned!");
        return;
      }

      const existingAssignments = this.assignments.slice();

      const prompt = this.createAssignmentPrompt(
        unassignedActivities,
        existingAssignments
      );
      const text = await llm.executeLLM(prompt);

      console.log("✅ Received response from Gemini AI!");
      console.log("\n🤖 RAW GEMINI RESPONSE");
      console.log("======================");
      console.log(text);
      console.log("======================\n");

      // Parse and apply the assignments
      this.parseAndApplyAssignments(text, unassignedActivities);
    } catch (error) {
      console.error("❌ Error calling Gemini API:", (error as Error).message);
      throw error;
    }
  }

  /**
   * Helper functions and queries follow
   */

  private isAssigned(activity: Activity): boolean {
    return this.assignments.some(
      (assignment) => assignment.activity === activity
    );
  }
  /**
   * Create the prompt for Gemini with hardwired preferences
   */
  private createAssignmentPrompt(
    activities: Activity[],
    existingAssignments: Assignment[]
  ): string {
    const existingAssignmentsSection =
      existingAssignments.length > 0
        ? `\nEXISTING ASSIGNMENTS (ALREADY SCHEDULED - DO NOT MODIFY):\n${this.assignmentsToString(
            existingAssignments
          )}\n`
        : "";

    const criticalRequirements = [
      "1. ONLY assign the activities listed above - do NOT add any new activities",
      "2. Use ONLY valid time slots (0-47)",
      "3. Avoid conflicts - don't overlap activities",
      "4. Consider the duration of each activity when scheduling",
      "5. Use appropriate time slots based on the preferences above",
      "6. Never assign an activity to more than one time slot",
    ];

    if (existingAssignments.length > 0) {
      criticalRequirements.push(
        `${
          criticalRequirements.length + 1
        }. Keep the existing assignments listed above exactly as they are (no overlaps or changes)`
      );
    }

    return `
You are a helpful AI assistant that creates optimal daily schedules for students.

STUDENT PREFERENCES:
- Exercise activities work well in the morning (6:00 AM - 10:00 AM)
- Classes and study time should be scheduled during focused hours (9:00 AM - 5:00 PM)
- Meals should be at regular intervals (breakfast 7-9 AM, lunch 12-1 PM, dinner 6-8 PM)
- Social activities and relaxation are good for evenings (6:00 PM - 10:00 PM)
- Avoid scheduling demanding activities too late at night (after 10:00 PM)
- Leave buffer time between different types of activities

TIME SYSTEM:
- Times are represented in half-hour slots starting at midnight
- Slot 0 = 12:00 AM, Slot 13 = 6:30 AM, Slot 26 = 1:00 PM, Slot 38 = 7:00 PM, etc.
- There are 48 slots total (24 hours x 2)
- Valid slots are 0-47 (midnight to 11:30 PM)

${existingAssignmentsSection}ACTIVITIES TO SCHEDULE (ONLY THESE - DO NOT ADD OTHERS):
${this.activitiesToString(activities)}

CRITICAL REQUIREMENTS:
${criticalRequirements.join("\n")}

Return your response as a JSON object with this exact structure:
{
  "assignments": [
    {
      "title": "exact activity title from the list above",
      "startTime": valid_slot_number_0_to_47
    }
  ]
}

Return ONLY the JSON object, no additional text.`;
  }

  /**
   * Parse the LLM response and apply the generated assignments
   */
  private parseAndApplyAssignments(
    responseText: string,
    unassignedActivities: Activity[]
  ): void {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const response = JSON.parse(jsonMatch[0]);

      if (!response.assignments || !Array.isArray(response.assignments)) {
        throw new Error("Invalid response format");
      }

      console.log("📝 Applying LLM assignments...");

      const activitiesByTitle = new Map<string, Activity[]>();
      for (const activity of unassignedActivities) {
        const list = activitiesByTitle.get(activity.title) ?? [];
        list.push(activity);
        activitiesByTitle.set(activity.title, list);
      }

      const issues: string[] = [];
      const validatedAssignments: { activity: Activity; startTime: number }[] =
        [];
      const occupiedSlots = new Map<number, Activity>();

      for (const existingAssignment of this.assignments) {
        for (
          let offset = 0;
          offset < existingAssignment.activity.duration;
          offset++
        ) {
          occupiedSlots.set(
            existingAssignment.startTime + offset,
            existingAssignment.activity
          );
        }
      }

      for (const rawAssignment of response.assignments) {
        if (typeof rawAssignment !== "object" || rawAssignment === null) {
          issues.push("Encountered an assignment entry that is not an object.");
          continue;
        }

        const { title, startTime } = rawAssignment as {
          title?: unknown;
          startTime?: unknown;
        };

        if (typeof title !== "string" || title.trim().length === 0) {
          issues.push("Assignment is missing a valid activity title.");
          continue;
        }

        const pool = activitiesByTitle.get(title);
        if (!pool || pool.length === 0) {
          issues.push(
            `No available occurrences of activity "${title}" to assign.`
          );
          continue;
        }

        const activity = pool.shift() as Activity;

        if (typeof startTime !== "number" || !Number.isInteger(startTime)) {
          issues.push(`Activity "${title}" has a non-integer start time.`);
          continue;
        }

        if (startTime < 0 || startTime > 47) {
          issues.push(
            `Activity "${title}" has an out-of-range start time (${startTime}).`
          );
          continue;
        }

        const endSlot = startTime + activity.duration;
        if (endSlot > 48) {
          issues.push(
            `Activity "${title}" would extend past the end of the day.`
          );
          continue;
        }

        let conflictDetected = false;
        for (let offset = 0; offset < activity.duration; offset++) {
          const slot = startTime + offset;
          const occupyingActivity = occupiedSlots.get(slot);
          if (occupyingActivity) {
            issues.push(
              `Time slot ${this.formatTimeSlot(slot)} is already taken by "${
                occupyingActivity.title
              }" and conflicts with "${title}".`
            );
            conflictDetected = true;
            break;
          }
        }

        if (conflictDetected) {
          // Put the activity back so we can report subsequent issues accurately.
          pool.unshift(activity);
          continue;
        }

        for (let offset = 0; offset < activity.duration; offset++) {
          occupiedSlots.set(startTime + offset, activity);
        }

        validatedAssignments.push({ activity, startTime });
      }

      if (issues.length > 0) {
        throw new Error(
          `LLM provided disallowed assignments:\n- ${issues.join("\n- ")}`
        );
      }

      for (const assignment of validatedAssignments) {
        this.assignActivity(assignment.activity, assignment.startTime);
        console.log(
          `✅ Assigned "${assignment.activity.title}" to ${this.formatTimeSlot(
            assignment.startTime
          )}`
        );
      }
    } catch (error) {
      console.error("❌ Error parsing LLM response:", (error as Error).message);
      console.log("Response was:", responseText);
      throw error;
    }
  }

  /**
   * Return assigned activities organized by time slots
   */
  getSchedule(): { [timeSlot: number]: Activity[] } {
    const schedule: { [timeSlot: number]: Activity[] } = {};

    // Initialize all possible time slots (48 half-hour slots in a day)
    for (let i = 0; i < 48; i++) {
      schedule[i] = [];
    }

    // Walk through assignments and place activities in their time slots
    for (const assignment of this.assignments) {
      const startTime = assignment.startTime;
      const duration = assignment.activity.duration;

      // Place the activity in all its occupied time slots
      for (let i = 0; i < duration; i++) {
        const slot = startTime + i;
        if (slot < 48) {
          // Ensure we don't go beyond 24 hours
          schedule[slot].push(assignment.activity);
        }
      }
    }

    return schedule;
  }

  /**
   * Format time slot number to readable time string
   * @param timeSlot - Time slot number (0-47)
   * @returns Formatted time string (e.g., "6:30 AM")
   */
  formatTimeSlot(timeSlot: number): string {
    const hours = Math.floor(timeSlot / 2);
    const minutes = (timeSlot % 2) * 30;
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  }

  private activitiesToString(activities: Activity[]): string {
    return activities
      .map((activity) => {
        const durationStr =
          activity.duration === 1
            ? "30 minutes"
            : `${activity.duration * 0.5} hours`;
        return `- ${activity.title} (${durationStr})`;
      })
      .join("\n");
  }

  private assignmentsToString(assignments: Assignment[]): string {
    return assignments
      .map((assignment) => {
        const time = this.formatTimeSlot(assignment.startTime);
        const durationStr =
          assignment.activity.duration === 1
            ? "30 minutes"
            : `${assignment.activity.duration * 0.5} hours`;
        return `- ${assignment.activity.title} at ${time} (${durationStr})`;
      })
      .join("\n");
  }

  /**
   * Display the current schedule in a readable format
   */
  displaySchedule(): void {
    const schedule = this.getSchedule();

    console.log("\n📅 Daily Schedule");
    console.log("==================");

    let hasActivities = false;

    for (let slot = 0; slot < 48; slot++) {
      const activities = schedule[slot];
      if (activities.length > 0) {
        hasActivities = true;
        const timeStr = this.formatTimeSlot(slot);

        // Only show the start of each activity (not every half-hour)
        const isActivityStart = activities.some(
          (activity) =>
            this.assignments.find((a) => a.activity === activity)?.startTime ===
            slot
        );

        if (isActivityStart) {
          const uniqueActivities = [...new Set(activities)];
          for (const activity of uniqueActivities) {
            const durationStr =
              activity.duration === 1
                ? "30 min"
                : `${activity.duration * 0.5} hours`;
            console.log(`${timeStr} - ${activity.title} (${durationStr})`);
          }
        }
      }
    }

    if (!hasActivities) {
      console.log("No activities scheduled yet.");
    }

    console.log("\n📋 Unassigned Activities");
    console.log("========================");
    const unassigned = this.activities.filter((a) => !this.isAssigned(a));
    if (unassigned.length > 0) {
      unassigned.forEach((activity) => {
        const durationStr =
          activity.duration === 1
            ? "30 min"
            : `${activity.duration * 0.5} hours`;
        console.log(`- ${activity.title} (${durationStr})`);
      });
    } else {
      console.log("All activities are assigned!");
    }
  }
}
