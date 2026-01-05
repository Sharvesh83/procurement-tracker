/**
 * Seed Data Script
 * 
 * Generates synthetic procurement data for testing and demonstration.
 * Uses deterministic random generation for reproducible results.
 * 
 * Usage: npm run seed
 */

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { syntheticDataGenerator } = require('../services/dataIngestion');
const { appendEvent } = require('../services/ledger');
const { recomputeAllBaselines } = require('../services/baselines');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

const DEMO_USERS = [
    {
        username: 'officer1',
        password: 'Officer123!',
        role: ROLES.PROCUREMENT_OFFICER,
        fullName: 'Rajesh Kumar',
        departmentId: 'DEPT-PUBLIC-WORKS',
        email: 'officer1@gov.in'
    },
    {
        username: 'officer2',
        password: 'Officer123!',
        role: ROLES.PROCUREMENT_OFFICER,
        fullName: 'Priya Sharma',
        departmentId: 'DEPT-HEALTH',
        email: 'officer2@gov.in'
    },
    {
        username: 'auditor1',
        password: 'Auditor123!',
        role: ROLES.AUDITOR,
        fullName: 'Anand Mehta',
        email: 'auditor1@gov.in'
    },
    {
        username: 'auditor2',
        password: 'Auditor123!',
        role: ROLES.AUDITOR,
        fullName: 'Sunita Patel',
        email: 'auditor2@gov.in'
    }
];

async function seedUsers() {
    console.log('\n📝 Creating demo users...');

    for (const userData of DEMO_USERS) {
        try {
            const existingUser = await User.findOne({ username: userData.username });

            if (existingUser) {
                console.log(`   User ${userData.username} already exists, skipping`);
                continue;
            }

            const user = new User(userData);
            await user.save();
            console.log(`   ✓ Created ${userData.role}: ${userData.username}`);
        } catch (error) {
            console.error(`   ✗ Failed to create ${userData.username}:`, error.message);
        }
    }
}

async function seedEvents(count = 30) {
    console.log(`\n📦 Generating ${count} tender lifecycles...`);

    // Generate synthetic data
    const events = syntheticDataGenerator.generateBatch(count, {
        baseDate: new Date()
    });

    console.log(`   Generated ${events.length} total events`);
    console.log('\n📥 Inserting events into ledger...');

    // Get the procurement officer user for attribution
    const officer = await User.findOne({ role: ROLES.PROCUREMENT_OFFICER });
    const enteredBy = officer ? officer._id.toString() : 'system-seed';

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < events.length; i++) {
        try {
            await appendEvent(events[i], enteredBy);
            successCount++;

            // Progress indicator
            if ((i + 1) % 50 === 0 || i === events.length - 1) {
                process.stdout.write(`\r   Progress: ${i + 1}/${events.length} events`);
            }
        } catch (error) {
            errorCount++;
            console.error(`\n   ✗ Failed to insert event ${i}:`, error.message);
        }
    }

    console.log(`\n   ✓ Inserted ${successCount} events, ${errorCount} errors`);
}

async function computeBaselines() {
    console.log('\n📊 Computing baselines...');

    const result = await recomputeAllBaselines();

    console.log(`   ✓ Computed baselines:`);
    console.log(`     - Departments: ${result.departments}`);
    console.log(`     - Suppliers: ${result.suppliers}`);
    console.log(`     - Periods: ${result.periods}`);

    if (result.errors.length > 0) {
        console.log(`   ⚠ ${result.errors.length} errors during baseline computation`);
    }

    console.log(`   ✓ Duration: ${result.duration_ms}ms`);
}

async function main() {
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║   PROCUREMENT MONITORING SYSTEM - SEED DATA        ║');
    console.log('╚════════════════════════════════════════════════════╝');

    try {
        // Connect to database
        await connectDB();

        // Parse arguments
        const args = process.argv.slice(2);
        const tenderCount = parseInt(args[0], 10) || 30;

        // Seed users
        await seedUsers();

        // Seed events
        await seedEvents(tenderCount);

        // Compute baselines
        await computeBaselines();

        console.log('\n✅ Seed completed successfully!\n');
        console.log('Demo credentials:');
        console.log('  Procurement Officer: officer1 / Officer123!');
        console.log('  Auditor: auditor1 / Auditor123!');
        console.log('');

    } catch (error) {
        console.error('\n❌ Seed failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

main();
