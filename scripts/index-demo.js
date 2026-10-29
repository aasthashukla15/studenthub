// INDEXING DEMO for the practical
//
//   npm run index-demo              -> uses 30,000 generated documents
//   npm run index-demo -- 100000    -> choose your own number of documents
//
// What this script does:
//   1. Lists the indexes on the real "students" collection.
//   2. Creates a TEMPORARY collection called "students_index_demo" with lots of fake students
//      (your real student data is never touched).
//   3. Runs explain("executionStats") on two queries WITHOUT an index  -> COLLSCAN
//   4. Creates the indexes and runs the SAME queries again            -> IXSCAN
//   5. Prints a before / after comparison table and deletes the temporary collection.
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Student = require('../src/models/Student');

const DEMO_COLLECTION = 'students_index_demo';
const TOTAL_DOCS = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 30000;

const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics & Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Business Administration',
  'Chemical Engineering',
];

// Walk through the explain() output and collect every "stage" name (COLLSCAN, IXSCAN, FETCH, ...)
function collectStages(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (typeof node.stage === 'string') found.push(node.stage);
  Object.values(node).forEach((child) => collectStages(child, found));
  return found;
}

async function runExplain(collection, label, filter) {
  const explain = await collection.find(filter).explain('executionStats');
  const stages = collectStages(explain.queryPlanner.winningPlan);
  const scan = stages.includes('IXSCAN') ? 'IXSCAN' : stages.includes('COLLSCAN') ? 'COLLSCAN' : stages.join(' > ');
  const stats = explain.executionStats;

  return {
    Query: label,
    'Scan type': scan,
    'Docs examined': stats.totalDocsExamined,
    'Keys examined': stats.totalKeysExamined,
    'Docs returned': stats.nReturned,
    'Time (ms)': stats.executionTimeMillis,
  };
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function insertFakeStudents(collection, total) {
  const batchSize = 5000;
  for (let start = 0; start < total; start += batchSize) {
    const docs = [];
    for (let i = start; i < Math.min(start + batchSize, total); i++) {
      docs.push({
        name: `Demo Student ${i}`,
        registrationNumber: `DEMO${String(i).padStart(7, '0')}`,
        email: `demo${i}@college.edu`,
        department: randomItem(DEPARTMENTS),
        semester: 1 + Math.floor(Math.random() * 8),
        cgpa: Number((5 + Math.random() * 5).toFixed(2)),
        createdAt: new Date(),
      });
    }
    await collection.insertMany(docs);
    process.stdout.write(`\r  inserted ${Math.min(start + batchSize, total)} / ${total}`);
  }
  process.stdout.write('\n');
}

async function main() {
  await connectDB();
  await Student.init(); // make sure the real indexes exist
  const db = mongoose.connection.db;

  // ----- Step 1: indexes on the real collection -----
  console.log('\n=== STEP 1: Indexes on the real "students" collection ===');
  const realIndexes = await Student.collection.indexes();
  realIndexes.forEach((ix) => {
    console.log(`  ${ix.name.padEnd(28)} key=${JSON.stringify(ix.key)}${ix.unique ? '  (UNIQUE)' : ''}`);
  });

  // ----- Step 2: temporary demo collection -----
  console.log(`\n=== STEP 2: Creating temporary collection "${DEMO_COLLECTION}" with ${TOTAL_DOCS} students ===`);
  const demo = db.collection(DEMO_COLLECTION);
  await demo.drop().catch(() => {}); // ignore "ns not found" when it does not exist yet
  await insertFakeStudents(demo, TOTAL_DOCS);

  const departmentQuery = { department: 'Computer Science', semester: 5 };
  const regNoQuery = { registrationNumber: `DEMO${String(Math.floor(TOTAL_DOCS / 2)).padStart(7, '0')}` };

  // ----- Step 3: BEFORE -----
  console.log('\n=== STEP 3: BEFORE adding indexes (only the default _id index exists) ===');
  const before = [
    await runExplain(demo, 'department + semester', departmentQuery),
    await runExplain(demo, 'registrationNumber', regNoQuery),
  ];
  console.table(before);

  // ----- Step 4: create the same indexes the real model uses -----
  console.log('=== STEP 4: Creating indexes (same ones as src/models/Student.js) ===');
  await demo.createIndex({ registrationNumber: 1 }, { unique: true });
  await demo.createIndex({ department: 1 });
  await demo.createIndex({ semester: 1 });
  (await demo.indexes()).forEach((ix) => console.log(`  ${ix.name}  ${JSON.stringify(ix.key)}`));

  // ----- Step 5: AFTER -----
  console.log('\n=== STEP 5: AFTER adding indexes (same queries) ===');
  const after = [
    await runExplain(demo, 'department + semester', departmentQuery),
    await runExplain(demo, 'registrationNumber', regNoQuery),
  ];
  console.table(after);

  // ----- Step 6: summary -----
  console.log('=== SUMMARY ===');
  before.forEach((b, i) => {
    const a = after[i];
    console.log(
      `  ${b.Query}: ${b['Scan type']} examined ${b['Docs examined']} docs  ->  ${a['Scan type']} examined ${a['Docs examined']} docs`
    );
  });
  console.log('\n  COLLSCAN = MongoDB read EVERY document in the collection (slow on big data).');
  console.log('  IXSCAN   = MongoDB used an index and jumped straight to the matching documents (fast).');
  console.log('  The key number to compare is "Docs examined": it drops from the whole collection to about the same as "Docs returned".');

  // ----- Cleanup -----
  await demo.drop();
  console.log(`\nTemporary collection "${DEMO_COLLECTION}" removed. Your real data was not changed.\n`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\nIndex demo failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
