/**
 * DayPlanner Test Cases
 * 
 * Demonstrates both manual scheduling and LLM-assisted scheduling
 */

import { DayPlanner } from './dayplanner';
import { GeminiLLM, Config } from './gemini-llm';

/**
 * Load configuration from config.json
 */
function loadConfig(): Config {
    try {
        const config = require('../config.json');
        return config;
    } catch (error) {
        console.error('❌ Error loading config.json. Please ensure it exists with your API key.');
        console.error('Error details:', (error as Error).message);
        process.exit(1);
    }
}

/**
 * Test case 1: Manual scheduling
 * Demonstrates adding activities and manually assigning them to time slots
 */
export async function testManualScheduling(): Promise<void> {
    console.log('\n🧪 TEST CASE 1: Manual Scheduling');
    console.log('==================================');
    
    const planner = new DayPlanner();
    
    // Add some activities
    console.log('📝 Adding activities...');
    const breakfast = planner.addActivity('Breakfast', 1); // 30 minutes
    const workout = planner.addActivity('Morning Workout', 2); // 1 hour
    const study = planner.addActivity('Study Session', 3); // 1.5 hours
    const lunch = planner.addActivity('Lunch', 1); // 30 minutes
    const meeting = planner.addActivity('Team Meeting', 2); // 1 hour
    const dinner = planner.addActivity('Dinner', 1); // 30 minutes
    const reading = planner.addActivity('Evening Reading', 2); // 1 hour
    
    // Manually assign activities to time slots
    console.log('⏰ Manually assigning activities...');
    planner.assignActivity(breakfast, 14); // 7:00 AM
    planner.assignActivity(workout, 16); // 8:00 AM
    planner.assignActivity(study, 20); // 10:00 AM
    planner.assignActivity(lunch, 26); // 1:00 PM
    planner.assignActivity(meeting, 30); // 3:00 PM
    planner.assignActivity(dinner, 38); // 7:00 PM
    planner.assignActivity(reading, 42); // 9:00 PM
    
    // Display the schedule
    planner.displaySchedule();
}

/**
 * Test case 2: LLM-assisted scheduling
 * Demonstrates adding activities and letting the LLM assign them automatically
 */
export async function testLLMScheduling(): Promise<void> {
    console.log('\n🧪 TEST CASE 2: LLM-Assisted Scheduling');
    console.log('========================================');
    
    const planner = new DayPlanner();
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Add some activities (similar to manual test but different)
    console.log('📝 Adding activities...');
    planner.addActivity('Morning Jog', 2); // 1 hour
    planner.addActivity('Math Homework', 4); // 2 hours
    planner.addActivity('Coffee Break', 1); // 30 minutes
    planner.addActivity('History Class', 2); // 1 hour
    planner.addActivity('Lunch with Friends', 2); // 1 hour
    planner.addActivity('Project Work', 3); // 1.5 hours
    planner.addActivity('Gym Session', 2); // 1 hour
    planner.addActivity('Movie Night', 3); // 1.5 hours
    
    // Display initial state (all unassigned)
    console.log('\n📋 Initial state - all activities unassigned:');
    planner.displaySchedule();
    
    // Let the LLM assign all activities
    await planner.assignActivities(llm);
    
    // Display the final schedule
    console.log('\n📅 Final schedule after LLM assignment:');
    planner.displaySchedule();
}

/**
 * Test case 3: Mixed scheduling
 * Demonstrates adding some activities manually and others via LLM
 */
export async function testMixedScheduling(): Promise<void> {
    console.log('\n🧪 TEST CASE 3: Mixed Scheduling');
    console.log('=================================');
    
    const planner = new DayPlanner();
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Add activities
    console.log('📝 Adding activities...');
    const breakfast = planner.addActivity('Breakfast', 1);
    const workout = planner.addActivity('Morning Workout', 2);
    planner.addActivity('Study Session', 3);
    planner.addActivity('Lunch', 1);
    planner.addActivity('Team Meeting', 2);
    planner.addActivity('Dinner', 1);
    planner.addActivity('Evening Reading', 2);
    
    // Manually assign some activities
    console.log('⏰ Manually assigning breakfast and workout...');
    planner.assignActivity(breakfast, 14); // 7:00 AM
    planner.assignActivity(workout, 16); // 8:00 AM
    
    // Display partial schedule
    console.log('\n📅 Partial schedule after manual assignments:');
    planner.displaySchedule();
    
    // Let LLM assign the remaining activities
    await planner.assignActivities(llm);
    
    // Display final schedule
    console.log('\n📅 Final schedule after LLM assignment:');
    planner.displaySchedule();
}

/**
 * Main function to run all test cases
 */
async function main(): Promise<void> {
    console.log('🎓 DayPlanner Test Suite');
    console.log('========================\n');
    
    try {
        // Run manual scheduling test
        await testManualScheduling();
        
        // Run LLM scheduling test
        await testLLMScheduling();
        
        // Run mixed scheduling test
        await testMixedScheduling();
        
        console.log('\n🎉 All test cases completed successfully!');
        
    } catch (error) {
        console.error('❌ Test error:', (error as Error).message);
        process.exit(1);
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    main();
}
