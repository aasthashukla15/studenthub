// Mongoose model: describes what a "student" document looks like in MongoDB
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be at most 100 characters'],
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      trim: true,
      uppercase: true, // "cs2023001" and "CS2023001" are treated as the same number
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: [1, 'Semester must be between 1 and 8'],
      max: [8, 'Semester must be between 1 and 8'],
      validate: {
        validator: Number.isInteger,
        message: 'Semester must be a whole number',
      },
    },
    cgpa: {
      type: Number,
      min: [0, 'CGPA must be between 0 and 10'],
      max: [10, 'CGPA must be between 0 and 10'],
    },
  },
  {
    // Adds a createdAt field automatically (we do not need updatedAt for this project)
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ---------------------------------------------------------------------------
// INDEXES (important for the practical)
// An index is like the index at the back of a book: MongoDB can jump straight
// to matching documents instead of reading the whole collection (COLLSCAN).
// ---------------------------------------------------------------------------

// 1. UNIQUE index: stops two students from having the same registration number
//    and makes "find by registration number" very fast.
studentSchema.index({ registrationNumber: 1 }, { unique: true });

// 2. Used by the "Filter by department" dropdown.
studentSchema.index({ department: 1 });

// 3. Used by the "Filter by semester" dropdown and the semester dashboard card.
studentSchema.index({ semester: 1 });

module.exports = mongoose.model('Student', studentSchema);
