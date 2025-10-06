## Augmented Concept Specification

**concept** ScheduleGenerator[User, Time, RepeatTime, Date, Percent, GeminiLLM]\
**purpose** manages events and tasks for users to automatically generate a schedule that meets their needs\
**principle** Given a set of events and tasks, an optimal schedule for the user is created using an LLM. The schedule can be regenerated when making changes to events and tasks.

**state**

    a set of Schedules with
        an owner User
        a set of Events
        a set of Tasks
        a timestamp Number (static attribute, initially -1)

    a set of Events with
        a name String
        a schedulePointer Schedule
        a startTime Time
        an endTime Time
        a repeatTime RepeatTime

    a set of Tasks with
        a name String
        a schedulePointer Schedule
        a deadline Date
        an expectedCompletionTime Number
        a completionLevel Percent
        a priority Percent

**actions**

    initializeSchedule(owner: User): (schedule: Schedule)
        requires: owner exists
        effects: creates an empty schedule with owner as schedule.owner, with static attribute schedule.timestamp incrementing by 1

    addEvent(schedule: Schedule, name: String, startTime: Time, endTime: Time, repeatTime: RepeatTime): (event: Event)
        requires: schedule exists
        effects: creates and returns an event with name to add to the set of events in schedule with the given attributes, with schedulePointer pointing to schedule

    editEvent(schedule: Schedule, oldEvent: Event, name: string, startTime: Time, endTime: Time, repeatTime: RepeatTime)
        requires: oldEvent is in the set of Events of schedule
        effects: modifies oldEvent in the set of Events in schedule with the given attributes

    deleteEvent(schedule: Schedule, event: Event)
        requires: event is in the set of Events of schedule
        effects: deletes event in the set of Events in schedule

    submitEvents(schedule: Schedule): (newShedule: Schedule | e: Error)
        requires: schedule exists
        effects:
            Modifies schedule into newSchedule for schedule.owner such that if possible, all given events start, end, and repeat as specified

            If doing this is not possible, then return an error.

    addTask(schedule: Schedule, name: String, deadline: Date, expectedCompletionTime: Number, priority: Percent): (task: Task)
        requires: schedule exists
        effects: returns and adds task with name to the set of tasks in schedule with the given attributes and 0% for completionLevel, with schedulePointer pointing to schedule

    editTask(schedule: Schedule, oldTask: Task, name: String, deadline: Date, expectedCompletionTime: Number, completionLevel: Percent priority: Percent)
        requires: oldTask is in the set of Tasks of schedule
        effects: modifies oldTasks in the set of Events in schedule with the given attributes

    deleteTask(schedule: Schedule, task: Task)
        requires: task is in the set of Tasks of schedule
        effects: deletes task in the set of Tasks in schedule

    generateSchedule(schedule: Schedule, llm: GeminiLLM): (newSchedule: Schedule | e: Error)
        requires: schedule and llm exist

        effects:
            Uses llm to create newSchedule with newSchedule.timestamp = schedule.timestamp + 1 for schedule.owner such that if possible, all given events start, end, and repeat as specified, and task scheduling is optimized by its attributes.

            Generally, tasks with a sooner deadline, higher priority level, higher expectedCompletionTime, and higher completionTime are scheduled first.

            If doing this is not possible, then return an error.
