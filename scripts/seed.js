// OPTIONAL: fills the database with sample students so the dashboard looks good in a demo.
//
//   npm run seed            -> adds the sample students (skips ones that already exist)
//   npm run seed -- --clear -> deletes ALL students first, then adds the sample students
//
// The app itself works fine with an empty database - you do not have to run this.
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Student = require('../src/models/Student');

const sampleStudents = [
  { name: 'Aarav Sharma', registrationNumber: 'CS2023001', email: 'aarav.sharma@college.edu', department: 'Computer Science', semester: 5, cgpa: 8.72 },
  { name: 'Diya Patel', registrationNumber: 'CS2023002', email: 'diya.patel@college.edu', department: 'Computer Science', semester: 5, cgpa: 9.1 },
  { name: 'Vihaan Gupta', registrationNumber: 'CS2024003', email: 'vihaan.gupta@college.edu', department: 'Computer Science', semester: 3, cgpa: 7.45 },
  { name: 'Ananya Iyer', registrationNumber: 'CS2024004', email: 'ananya.iyer@college.edu', department: 'Computer Science', semester: 3, cgpa: 8.05 },
  { name: 'Rohan Verma', registrationNumber: 'IT2023005', email: 'rohan.verma@college.edu', department: 'Information Technology', semester: 5, cgpa: 6.85 },
  { name: 'Meera Nair', registrationNumber: 'IT2023006', email: 'meera.nair@college.edu', department: 'Information Technology', semester: 5, cgpa: 8.4 },
  { name: 'Kabir Singh', registrationNumber: 'IT2024007', email: 'kabir.singh@college.edu', department: 'Information Technology', semester: 1, cgpa: 7.2 },
  { name: 'Ishita Reddy', registrationNumber: 'EC2022008', email: 'ishita.reddy@college.edu', department: 'Electronics & Communication', semester: 7, cgpa: 8.9 },
  { name: 'Arjun Mehta', registrationNumber: 'EC2022009', email: 'arjun.mehta@college.edu', department: 'Electronics & Communication', semester: 7, cgpa: 6.3 },
  { name: 'Saanvi Joshi', registrationNumber: 'EC2023010', email: 'saanvi.joshi@college.edu', department: 'Electronics & Communication', semester: 5, cgpa: 7.8 },
  { name: 'Reyansh Kumar', registrationNumber: 'ME2022011', email: 'reyansh.kumar@college.edu', department: 'Mechanical Engineering', semester: 7, cgpa: 7.1 },
  { name: 'Kavya Desai', registrationNumber: 'ME2023012', email: 'kavya.desai@college.edu', department: 'Mechanical Engineering', semester: 5, cgpa: 8.25 },
  { name: 'Aditya Rao', registrationNumber: 'CE2024013', email: 'aditya.rao@college.edu', department: 'Civil Engineering', semester: 3, cgpa: 6.6 },
  { name: 'Pooja Bansal', registrationNumber: 'CE2023014', email: 'pooja.bansal@college.edu', department: 'Civil Engineering', semester: 5, cgpa: 9.3 },
  { name: 'Nikhil Chauhan', registrationNumber: 'EE2022015', email: 'nikhil.chauhan@college.edu', department: 'Electrical Engineering', semester: 7, cgpa: 7.6 },
  { name: 'Tanvi Kulkarni', registrationNumber: 'EE2024016', email: 'tanvi.kulkarni@college.edu', department: 'Electrical Engineering', semester: 1, cgpa: 8.0 },
  { name: 'Yash Malhotra', registrationNumber: 'BA2023017', email: 'yash.malhotra@college.edu', department: 'Business Administration', semester: 5 },
  { name: 'Riya Agarwal', registrationNumber: 'BA2024018', email: 'riya.agarwal@college.edu', department: 'Business Administration', semester: 3, cgpa: 8.55 },
];

async function seed() {
  await connectDB();
  await Student.init(); // make sure indexes exist

  if (process.argv.includes('--clear')) {
    const result = await Student.deleteMany({});
    console.log(`Removed ${result.deletedCount} existing student(s).`);
  }

  // "upsert" = insert only if no student with that registration number exists yet
  const operations = sampleStudents.map((student) => ({
    updateOne: {
      filter: { registrationNumber: student.registrationNumber },
      update: { $setOnInsert: student },
      upsert: true,
    },
  }));

  const result = await Student.bulkWrite(operations);
  console.log(`Added ${result.upsertedCount} new student(s); ${sampleStudents.length - result.upsertedCount} already existed.`);
  console.log(`Total students in database: ${await Student.countDocuments()}`);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
