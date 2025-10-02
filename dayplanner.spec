<concept_spec>
concept DayPlanner

purpose
    help organize activities for a single day

principle
    activities are added one at a time, each with a title and duration;
    activities are then assigned to time slots;
    you can then use an LLM to assign any remaining unassigned activities
    and view the resulting schedule

state
    a set of Activity with
        a title String
        a duration Number // in half-hour units, so 3 is 90 mins
        an optional startTime Number // in half-hour slots from midnight, so 14 is 7:00am

    a set of Assignment with
        an Activity
        an startTime Number

    invariants
        every assignment's activity is in the activity set
        there is at most one assignment per activity
        duration and startTime are between 0 and 47

actions    
    addActivity(title: String, duration: Number): Activity
        requires title is non-empty, duration is between 0 and 47
        effect adds fresh activity with title and duration and returns it
        note duration is measured in half hour increments, so 3 is 90 mins

    removeActivity(activity: Activity)
        requires activity exists
        effect removes activity

    assignActivity(activity: Activity, startTime: Number)
        requires activity exists and startTime is between 0 and 47
        effect adds fresh assignment for activity and startTime

    unassignActivity(activity: Activity)
        requires assignment for activity exists
        effect removes assignment for activity

    async assignActivities(llm: GeminiLLM)
        effect uses llm to assign all unassigned activities    

notes
    This is a very rudimentary concept to demonstrate how to use an LLM.
    
</concept_spec>