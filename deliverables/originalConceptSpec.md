## Original Concept Specification (from Assignment 2)

**concept** ScheduleGenerator[User, Time, RepeatTime, Date, Percent]\
**purpose** manages events and tasks for users to automatically generate a schedule that meets their needs\
**principle** Given a set of events and tasks, an optimal schedule for the user is created. When events and tasks are updated and removed, the schedule is regenerated

**state**

    a set of Schedules with
        an owner User
        a set of Events
        a set of Tasks

    a set of Events with
        a schedulePointer Schedule
        a startTime Time
        an endTime Time
        a repeatTime RepeatTime

    a set of Tasks with
        a schedulePointer Schedule
        a deadline Date
        an expectedCompletionTime Number
        a completionLevel Percent
        a priority Percent

**actions**

    addEvent(schedule: Schedule, startTime: Time, endTime: Time, repeatTime: RepeatTime): (event: Event)
        requires: schedule exists
        effects: creates and returns an event to add to the set of events in schedule with the given attributes, with schedulePointer pointing to schedule

    editEvent(schedule: Schedule, oldEvent: Event, startTime: Time, endTime: Time, repeatTime: RepeatTime)
        requires: oldEvent is in the set of Events of schedule
        effects: modifies oldEvent in the set of Events in schedule with the given attributes

    deleteEvent(schedule: Schedule, event: Event)
        requires: event is in the set of Events of schedule
        effects: deletes event in the set of Events in schedule

    addTask(schedule: Schedule, deadline: Date, expectedCompletionTime: Number, priority: Percent): (task: Task)
        requires: schedule exists
        effects: returns and adds task to the set of tasks in schedule with the given attributes and 0% for completionLevel, with schedulePointer pointing to schedule

    editTask(schedule: Schedule, oldTask: Task, deadline: Date, expectedCompletionTime: Number, completionLevel: Percent priority: Percent)
        requires: oldTask is in the set of Tasks of schedule
        effects: modifies oldTasks in the set of Events in schedule with the given attributes

    deleteTask(schedule: Schedule, task: Task)
        requires: task is in the set of Tasks of schedule
        effects: deletes task in the set of Tasks in schedule

    system generateSchedule(schedule: Schedule, events: set of Events, tasks: set of Tasks): (newSchedule: Schedule | e: Error)
        requires: any of the above actions in ScheduleGenerator were performed

        effects:
            Creates newSchedule for schedule.owner such that if possible, all given events start, end, and repeat as specified, and task scheduling is optimized by its attributes.

            Generally, tasks with a sooner deadline, higher priority level, higher expectedCompletionTime, and higher completionTime are scheduled first.

            If doing this is not possible, then return an error.
