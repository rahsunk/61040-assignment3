"use strict";
/**
 * (Simple) ScheduleGenerator implementation for Taskmate
 * - addEvent, editEvent, deleteEvent, addTask, editTask, deleteTask
 * - generateSchedule (LLM action)
 * - owner and schedulePointer attributes and set of Schedule state is omitted
 * - Time is represented as half-hour slots from 0 to 47 in a single day, like in Prep 2
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleGenerator = exports.status = void 0;
exports.formatTimeSlot = formatTimeSlot;
var status;
(function (status) {
    status["FREE"] = "free";
    status["EVENT"] = "event";
    status["TASK"] = "task";
})(status || (exports.status = status = {}));
var ScheduleGenerator = /** @class */ (function () {
    function ScheduleGenerator() {
        this.events = [];
        this.tasks = [];
        this.timestamp = 0;
    }
    ScheduleGenerator.prototype.addEvent = function (name, startTime, endTime, repeatTime) {
        var event = { name: name, startTime: startTime, endTime: endTime, repeatTime: repeatTime };
        this.events.push(event);
        return event;
    };
    ScheduleGenerator.prototype.editEvent = function (oldEvent, name, startTime, endTime, repeatTime) {
        var index = this.events.indexOf(oldEvent);
        if (index === -1)
            throw new Error("Event not found in schedule");
        this.events[index] = { name: name, startTime: startTime, endTime: endTime, repeatTime: repeatTime };
    };
    ScheduleGenerator.prototype.deleteEvent = function (event) {
        var index = this.events.indexOf(event);
        if (index === -1)
            throw new Error("Event not found in schedule");
        this.events.splice(index, 1);
    };
    ScheduleGenerator.prototype.addTask = function (name, deadline, expectedCompletionTime, priority) {
        var task = {
            name: name,
            deadline: deadline,
            expectedCompletionTime: expectedCompletionTime,
            completionLevel: 0,
            priority: priority,
        };
        this.tasks.push(task);
        return task;
    };
    ScheduleGenerator.prototype.editTask = function (oldTask, name, deadline, expectedCompletionTime, completionLevel, priority) {
        var index = this.tasks.indexOf(oldTask);
        if (index === -1)
            throw new Error("Task not found in schedule");
        this.tasks[index] = {
            name: name,
            deadline: deadline,
            expectedCompletionTime: expectedCompletionTime,
            completionLevel: completionLevel,
            priority: priority,
        };
    };
    ScheduleGenerator.prototype.deleteTask = function (task) {
        var index = this.tasks.indexOf(task);
        if (index === -1)
            throw new Error("Task not found in schedule");
        this.tasks.splice(index, 1);
    };
    /**
     * Current implementation places all events at their fixed times and schedules remaining tasks
     * into remaining free slots, ordered by (sooner deadline, higher priority, greater expected completion time)
     * The llm parameter is accepted for API compatibility but not used by the MVP.
     */
    ScheduleGenerator.prototype.generateSchedule = function (llm) {
        return __awaiter(this, void 0, void 0, function () {
            var occupied, blocks, sortedEvents, _i, sortedEvents_1, event_1, t, t, prompt, responseText, merged;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        occupied = new Array(48).fill(status.FREE);
                        blocks = [];
                        sortedEvents = __spreadArray([], this.events, true).sort(function (a, b) { return a.startTime - b.startTime; });
                        for (_i = 0, sortedEvents_1 = sortedEvents; _i < sortedEvents_1.length; _i++) {
                            event_1 = sortedEvents_1[_i];
                            if (!Number.isInteger(event_1.startTime) ||
                                !Number.isInteger(event_1.endTime) ||
                                event_1.startTime < 0 ||
                                event_1.endTime > 48 ||
                                event_1.endTime <= event_1.startTime) {
                                throw new Error("Event ".concat(event_1.name, " has invalid time bounds"));
                            }
                            for (t = event_1.startTime; t < event_1.endTime; t++) {
                                if (occupied[t] !== "free") {
                                    throw new Error("Event ".concat(event_1.name, " conflicts with another event at slot ").concat(t));
                                }
                            }
                            for (t = event_1.startTime; t < event_1.endTime; t++)
                                occupied[t] = status.EVENT;
                            blocks.push({
                                name: event_1.name,
                                startTime: event_1.startTime,
                                duration: event_1.endTime - event_1.startTime,
                                type: "event",
                                priority: 50, // default priority
                            });
                        }
                        prompt = this.createSchedulePrompt(blocks, this.tasks);
                        return [4 /*yield*/, llm.executeLLM(prompt)];
                    case 1:
                        responseText = _a.sent();
                        // Apply LLM-proposed task blocks with validation against fixed event occupancy
                        this.applyTaskAssignmentsFromLLM(responseText, occupied, blocks, this.tasks);
                        this.timestamp += 1;
                        merged = mergeAdjacentBlocks(blocks);
                        return [2 /*return*/, {
                                timestamp: this.timestamp,
                                blocks: merged.sort(function (a, b) { return b.priority - a.priority; }), // Sort by priority descending
                            }];
                }
            });
        });
    };
    /**
     * Build a structured prompt for Gemini to schedule tasks around fixed events.
     * The response must be a JSON object: { "assignments": [ { "task": string, "startTime": number, "duration": number } ] }
     */
    ScheduleGenerator.prototype.createSchedulePrompt = function (eventBlocks, tasks) {
        var fixedEvents = eventBlocks
            .filter(function (b) { return b.type === "event"; })
            .map(function (b) { return ({
            name: b.name,
            startTime: b.startTime,
            endTime: b.startTime + b.duration,
        }); });
        var taskList = tasks.map(function (t) { return ({
            name: t.name,
            expectedCompletionTime: t.expectedCompletionTime,
            priority: t.priority,
            // Use epoch ms for clarity
            deadlineMs: t.deadline.getTime(),
        }); });
        var fixedSection = JSON.stringify(fixedEvents, null, 2);
        var tasksSection = JSON.stringify(taskList, null, 2);
        return "You are a helpful scheduling assistant. Time is split into 48 half-hour slots (0 to 47).\n    Fixed events cannot be moved or overlapped. Schedule the tasks into remaining free slots.\n\n    Return ONLY valid JSON with this exact structure and keys:\n    {\n      \"assignments\": [\n        { \"task\": string, \"startTime\": number, \"duration\": number }\n      ]\n    }\n\n    TIME SYSTEM:\n      - Times are represented in half-hour slots starting at midnight\n      - Slot 0 = 12:00 AM, Slot 13 = 6:30 AM, Slot 26 = 1:00 PM, Slot 38 = 7:00 PM, etc.\n      - There are 48 slots total (24 hours x 2)\n      - Valid slots are 0-47 (midnight to 11:30 PM)\n\n    HARD CONSTRAINTS:\n    - Do not overlap any tasks with each other or with fixed events.\n    - Do not overlap multiple blocks of the same task with each other.\n    - duration must be >= 1 and sum of durations per task should be <= expectedCompletionTime for that task.\n    - You may split a task into multiple blocks, but each block must be in a separate, non-overlapping time slot.\n    - Consider tasks with sooner deadlines and higher priority to be scheduled earlier than tasks with later deadlines and lower priority.\n\n    STUDENT PREFERENCES:\n    - Avoid scheduling activities too late at night (after slot 44) or too early in the morning (before slot 12)\n    - Exercise activities work well in the morning (slots 12 to 20) and at night (slots 36 to 42)\n    - Classes and study time should be scheduled during focused hours (slots 18 to 42)\n    - Meals should be at regular intervals (breakfast: slots 14 to 18, lunch: slots 24 to 26, dinner: slots 36 to 40)\n    - Social activities and relaxation are good for evenings (slots 36 to 42)\n    - Try to buffer time between different types of activities\n\n    FIXED_EVENTS:\n    ".concat(fixedSection, "\n\n    TASKS:\n    ").concat(tasksSection);
    };
    /**
     * Parse LLM response and place task blocks while validating bounds and conflicts.
     */
    ScheduleGenerator.prototype.applyTaskAssignmentsFromLLM = function (responseText, occupied, blocks, tasks) {
        var _a, _b;
        // Extract JSON object from response
        var jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error("No JSON found in LLM response");
        var data = JSON.parse(jsonMatch[0]);
        if (!data || !Array.isArray(data.assignments)) {
            throw new Error("Invalid LLM response: missing assignments[]");
        }
        var taskByName = new Map();
        for (var _i = 0, tasks_1 = tasks; _i < tasks_1.length; _i++) {
            var t = tasks_1[_i];
            var list = (_a = taskByName.get(t.name)) !== null && _a !== void 0 ? _a : [];
            list.push(t);
            taskByName.set(t.name, list);
        }
        // Track how much of each task we have scheduled so far
        var scheduledSoFar = new Map();
        // Track occupied slots including task assignments from this LLM response
        var currentOccupied = __spreadArray([], occupied, true);
        var issues = [];
        var validated = [];
        for (var _c = 0, _d = data.assignments; _c < _d.length; _c++) {
            var entry = _d[_c];
            if (!entry || typeof entry !== "object") {
                issues.push("Non-object assignment entry");
                continue;
            }
            var _e = entry, task = _e.task, startTime = _e.startTime, duration = _e.duration;
            if (typeof task !== "string" || task.trim() === "") {
                issues.push("Assignment missing task name");
                continue;
            }
            if (!Number.isInteger(startTime) ||
                !Number.isInteger(duration)) {
                issues.push("Assignment for ".concat(task, " has non-integer times"));
                continue;
            }
            var s = startTime;
            var d = duration;
            if (s < 0 || s > 47) {
                issues.push("Start out of range for ".concat(task));
                continue;
            }
            if (d <= 0) {
                issues.push("Non-positive duration for ".concat(task));
                continue;
            }
            if (s + d > 48) {
                issues.push("Block exceeds day for ".concat(task));
                continue;
            }
            // ensure task exists
            var pool = taskByName.get(task);
            if (!pool || pool.length === 0) {
                issues.push("Unknown task ".concat(task));
                continue;
            }
            // ensure slots free
            var conflict = false;
            for (var t = s; t < s + d; t++) {
                if (currentOccupied[t] !== status.FREE) {
                    conflict = true;
                    break;
                }
            }
            if (conflict) {
                issues.push("Block for ".concat(task, " overlaps an occupied slot"));
                continue;
            }
            // limit by remaining expected time
            var expected = pool[0].expectedCompletionTime | 0;
            var used = (_b = scheduledSoFar.get(task)) !== null && _b !== void 0 ? _b : 0;
            var remaining = Math.max(0, expected - used);
            if (remaining <= 0) {
                continue;
            }
            var place = Math.min(remaining, d);
            // reserve slots
            for (var t = s; t < s + place; t++)
                currentOccupied[t] = status.TASK;
            scheduledSoFar.set(task, used + place);
            validated.push({ taskName: task, startTime: s, duration: place });
        }
        if (issues.length > 0) {
            throw new Error("LLM provided invalid assignments:\n- ".concat(issues.join("\n- ")));
        }
        var _loop_1 = function (v) {
            // Find the original task to get its priority
            var originalTask = tasks.find(function (t) { return t.name === v.taskName; });
            var taskPriority = originalTask ? originalTask.priority : 50; // fallback to 50 if task not found
            blocks.push({
                name: v.taskName,
                startTime: v.startTime,
                duration: v.duration,
                type: "task",
                priority: taskPriority,
            });
        };
        for (var _f = 0, validated_1 = validated; _f < validated_1.length; _f++) {
            var v = validated_1[_f];
            _loop_1(v);
        }
    };
    return ScheduleGenerator;
}());
exports.ScheduleGenerator = ScheduleGenerator;
function mergeAdjacentBlocks(blocks) {
    var byStart = __spreadArray([], blocks, true).sort(function (a, b) { return a.startTime - b.startTime; });
    var out = [];
    for (var _i = 0, byStart_1 = byStart; _i < byStart_1.length; _i++) {
        var b = byStart_1[_i];
        var last = out[out.length - 1];
        if (last &&
            last.type === b.type &&
            last.name === b.name &&
            last.priority === b.priority &&
            last.startTime + last.duration === b.startTime) {
            last.duration += b.duration;
        }
        else {
            out.push(__assign({}, b));
        }
    }
    return out;
}
// Small helpers (kept for potential debugging/printing during development)
function formatTimeSlot(timeSlot) {
    var hours = Math.floor(timeSlot / 2);
    var minutes = (timeSlot % 2) * 30;
    var period = hours >= 12 ? "PM" : "AM";
    var displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return "".concat(displayHours, ":").concat(minutes.toString().padStart(2, "0"), " ").concat(period);
}
