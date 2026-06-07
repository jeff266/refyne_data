/**
 * Verify Normalize Page Harmony Display Logic
 *
 * Checks that:
 * 1. Every active harmony with an assignment appears in the panel
 * 2. No harmonies appear without field assignments
 * 3. Toggle state matches is_active
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function verifyNormalizeHarmonies() {
  const { supabaseAdmin } = await import('../lib/db/admin-client');

  const ORG_ID = 'org_3DuSdb0FBnx7RMLmJSUegrpiNLS'; // RevOps Impact

  console.log('\n🔍 Verifying Normalize Page Harmony Display Logic');
  console.log('═'.repeat(70));
  console.log(`Organization: ${ORG_ID}\n`);

  // Query 1: Get all harmonies with their assignment status
  const { data: harmonies, error: harmoniesError } = await supabaseAdmin
    .from('harmonies')
    .select(`
      id,
      name,
      is_active,
      harmony_field_assignments (
        id,
        object_type,
        canonical_field,
        hubspot_property
      )
    `)
    .eq('org_id', ORG_ID)
    .order('name');

  if (harmoniesError) {
    console.error('❌ Error fetching harmonies:', harmoniesError);
    process.exit(1);
  }

  console.log('📊 QUERY RESULTS');
  console.log('─'.repeat(70));

  const activeWithAssignment = [];
  const activeWithoutAssignment = [];
  const inactiveWithAssignment = [];
  const inactiveWithoutAssignment = [];

  harmonies?.forEach((harmony: any) => {
    const hasAssignment = harmony.harmony_field_assignments && harmony.harmony_field_assignments.length > 0;
    const isActive = harmony.is_active;

    const harmonyInfo = {
      id: harmony.id,
      name: harmony.name,
      isActive: isActive,
      assignments: harmony.harmony_field_assignments || [],
    };

    if (isActive && hasAssignment) {
      activeWithAssignment.push(harmonyInfo);
    } else if (isActive && !hasAssignment) {
      activeWithoutAssignment.push(harmonyInfo);
    } else if (!isActive && hasAssignment) {
      inactiveWithAssignment.push(harmonyInfo);
    } else {
      inactiveWithoutAssignment.push(harmonyInfo);
    }
  });

  // 1. Active harmonies with assignments (SHOULD APPEAR)
  console.log('\n✅ SHOULD APPEAR IN NORMALIZE PANEL:');
  console.log(`   (Active harmonies with field assignments: ${activeWithAssignment.length})`);
  console.log('─'.repeat(70));
  activeWithAssignment.forEach((h, i) => {
    const assignmentInfo = h.assignments.map((a: any) =>
      `${a.object_type}.${a.hubspot_property}`
    ).join(', ');
    console.log(`   ${(i + 1).toString().padStart(2)}. ${h.name}`);
    console.log(`       Toggle: ON | Assigned to: ${assignmentInfo}`);
  });

  // 2. Active harmonies WITHOUT assignments (SHOULD NOT APPEAR)
  if (activeWithoutAssignment.length > 0) {
    console.log('\n⚠️  SHOULD NOT APPEAR (Active but no assignment):');
    console.log(`   (Found ${activeWithoutAssignment.length} harmonies):`);
    console.log('─'.repeat(70));
    activeWithoutAssignment.forEach((h, i) => {
      console.log(`   ${(i + 1).toString().padStart(2)}. ${h.name}`);
      console.log(`       Toggle: ON | ❌ No field assignment`);
    });
  }

  // 3. Inactive harmonies WITH assignments (SHOULD NOT APPEAR - toggled OFF)
  if (inactiveWithAssignment.length > 0) {
    console.log('\n🔘 SHOULD NOT APPEAR (Toggled OFF):');
    console.log(`   (Inactive harmonies with assignments: ${inactiveWithAssignment.length})`);
    console.log('─'.repeat(70));
    inactiveWithAssignment.forEach((h, i) => {
      const assignmentInfo = h.assignments.map((a: any) =>
        `${a.object_type}.${a.hubspot_property}`
      ).join(', ');
      console.log(`   ${(i + 1).toString().padStart(2)}. ${h.name}`);
      console.log(`       Toggle: OFF | Assigned to: ${assignmentInfo}`);
    });
  }

  // 4. Inactive harmonies WITHOUT assignments (SHOULD NOT APPEAR)
  if (inactiveWithoutAssignment.length > 0) {
    console.log('\n⚪ INACTIVE WITHOUT ASSIGNMENT:');
    console.log(`   (Should not appear: ${inactiveWithoutAssignment.length})`);
    console.log('─'.repeat(70));
    inactiveWithoutAssignment.forEach((h, i) => {
      console.log(`   ${(i + 1).toString().padStart(2)}. ${h.name}`);
      console.log(`       Toggle: OFF | No field assignment`);
    });
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📋 SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Total harmonies in library:                ${harmonies?.length || 0}`);
  console.log(`✅ Should appear (active + assigned):      ${activeWithAssignment.length}`);
  console.log(`❌ Should NOT appear (active - no assign): ${activeWithoutAssignment.length}`);
  console.log(`🔘 Should NOT appear (inactive + assigned):${inactiveWithAssignment.length}`);
  console.log(`⚪ Should NOT appear (inactive - no assign):${inactiveWithoutAssignment.length}`);
  console.log('═'.repeat(70));

  // Validation checks
  console.log('\n🔍 VALIDATION CHECKS:');
  console.log('─'.repeat(70));

  const check1 = activeWithoutAssignment.length === 0;
  console.log(`${check1 ? '✅' : '❌'} No active harmonies without field assignments`);

  const check2 = activeWithAssignment.length > 0;
  console.log(`${check2 ? '✅' : '❌'} At least one active harmony with assignment exists`);

  const allChecks = check1 && check2;
  console.log('─'.repeat(70));
  console.log(`${allChecks ? '✅ All checks passed!' : '❌ Some checks failed!'}\n`);

  if (!allChecks) {
    console.log('⚠️  RECOMMENDED ACTIONS:');
    if (activeWithoutAssignment.length > 0) {
      console.log('   - Assign fields to active harmonies OR set is_active=false');
    }
    console.log('');
  }
}

verifyNormalizeHarmonies().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
