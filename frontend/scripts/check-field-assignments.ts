#!/usr/bin/env node
import { supabase } from '../lib/db/supabase';
import { getFieldAssignments } from '../lib/harmonies/field-assignments';

const ORG_ID = 'org_3DuSdb0FBnx7RMLmJSUegrpiNLS';

async function main() {
  console.log('Checking field assignments...\n');

  const assignments = await getFieldAssignments(ORG_ID, 'company');
  const phoneAssignment = assignments.find(a => a.harmonyId === 'phone');
  const linkedinAssignment = assignments.find(a => a.harmonyId === 'linkedin-url');

  console.log('Phone:', phoneAssignment);
  console.log('\nLinkedIn:', linkedinAssignment);

  if (!supabase) return;

  const { data: harmonies } = await supabase
    .from('harmonies')
    .select('id, field, object_type')
    .in('id', ['phone', 'linkedin-url']);

  console.log('\nHarmonies:', harmonies);
}

main().catch(console.error);
