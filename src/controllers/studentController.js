// Controller: the functions that run when an API route is called
const Student = require('../models/Student');

// ---------- Helpers ----------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REG_NO_REGEX = /^[A-Za-z0-9\-/._]{3,30}$/;

// Escape characters that have a special meaning in regular expressions,
// so a search for "a.b" does not behave like a pattern.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Check the data sent by the form. Returns the cleaned data and any errors.
// (The Mongoose schema validates again as a second safety net.)
function validateStudentInput(body = {}) {
  const errors = {};

  const name = String(body.name ?? '').trim();
  const registrationNumber = String(body.registrationNumber ?? '').trim();
  const email = String(body.email ?? '').trim();
  const department = String(body.department ?? '').trim();

  if (!name) errors.name = 'Student name is required';
  else if (name.length < 2 || name.length > 100) errors.name = 'Name must be 2 to 100 characters';

  if (!registrationNumber) errors.registrationNumber = 'Registration number is required';
  else if (!REG_NO_REGEX.test(registrationNumber))
    errors.registrationNumber = 'Use 3-30 letters, numbers, or - / . _ (no spaces)';

  if (!email) errors.email = 'Email is required';
  else if (!EMAIL_REGEX.test(email)) errors.email = 'Please enter a valid email address';

  if (!department) errors.department = 'Department is required';
  else if (department.length < 2 || department.length > 80)
    errors.department = 'Department must be 2 to 80 characters';

  // Semester: required whole number from 1 to 8
  let semester = null;
  if (body.semester === undefined || body.semester === null || body.semester === '') {
    errors.semester = 'Semester is required';
  } else {
    semester = Number(body.semester);
    if (!Number.isInteger(semester) || semester < 1 || semester > 8)
      errors.semester = 'Semester must be a whole number from 1 to 8';
  }

  // CGPA: optional, but if given it must be a number from 0 to 10
  let cgpa;
  if (body.cgpa !== undefined && body.cgpa !== null && body.cgpa !== '') {
    cgpa = Number(body.cgpa);
    if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) errors.cgpa = 'CGPA must be a number from 0 to 10';
  }

  const data = { name, registrationNumber, email, department, semester };
  if (cgpa !== undefined) data.cgpa = cgpa;

  return { data, errors, isValid: Object.keys(errors).length === 0 };
}

// One place that turns any error into a friendly JSON response.
function handleError(res, err) {
  // Duplicate registration number (unique index violation)
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A student with this registration number already exists',
      errors: { registrationNumber: 'This registration number is already in use' },
    });
  }

  // Mongoose schema validation failed
  if (err.name === 'ValidationError') {
    const errors = {};
    Object.values(err.errors).forEach((e) => {
      errors[e.path] = e.message;
    });
    return res.status(400).json({ success: false, message: 'Please fix the highlighted fields', errors });
  }

  // Bad ID format
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid student ID' });
  }

  // Anything else is a server or database problem
  console.error('Server error:', err.message);
  return res.status(500).json({
    success: false,
    message: 'Something went wrong on the server. Please check the database connection and try again.',
  });
}

// ---------- Controllers ----------

// POST /api/students  -> create a student
exports.createStudent = async (req, res) => {
  try {
    const { data, errors, isValid } = validateStudentInput(req.body);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Please fix the highlighted fields', errors });
    }

    const student = await Student.create(data);
    res.status(201).json({ success: true, message: 'Student added successfully', data: student });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/students?search=&department=&semester=&limit=  -> list students
exports.getStudents = async (req, res) => {
  try {
    const { search, department, semester, limit } = req.query;
    const filter = {};

    // Search by name OR registration number (case-insensitive, partial match)
    if (search && search.trim()) {
      const pattern = escapeRegex(search.trim());
      filter.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { registrationNumber: { $regex: pattern, $options: 'i' } },
      ];
    }

    // Exact-match filters -> these use the department and semester indexes
    if (department && department.trim()) filter.department = department.trim();

    if (semester !== undefined && semester !== '') {
      const semesterNumber = Number(semester);
      if (!Number.isInteger(semesterNumber)) {
        return res.status(400).json({ success: false, message: 'Semester filter must be a whole number' });
      }
      filter.semester = semesterNumber;
    }

    let query = Student.find(filter).sort({ createdAt: -1 });

    // Optional limit (the dashboard uses limit=5 for "recent students")
    if (limit !== undefined) {
      const limitNumber = parseInt(limit, 10);
      if (!Number.isNaN(limitNumber) && limitNumber > 0) query = query.limit(Math.min(limitNumber, 100));
    }

    const students = await query.lean();
    res.json({ success: true, count: students.length, data: students });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/students/:id  -> one student
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, data: student });
  } catch (err) {
    handleError(res, err);
  }
};

// PUT /api/students/:id  -> update a student
exports.updateStudent = async (req, res) => {
  try {
    const { data, errors, isValid } = validateStudentInput(req.body);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Please fix the highlighted fields', errors });
    }

    // If CGPA was cleared in the form, remove it from the document.
    const update = { $set: data };
    if (data.cgpa === undefined) update.$unset = { cgpa: '' };

    const student = await Student.findByIdAndUpdate(req.params.id, update, {
      new: true, // return the updated document
      runValidators: true,
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, message: 'Student updated successfully', data: student });
  } catch (err) {
    handleError(res, err);
  }
};

// DELETE /api/students/:id  -> delete a student
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, message: 'Student deleted successfully', data: student });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/stats?semester=N  -> numbers for the dashboard cards
// If no semester is given, the highest semester found in the data is treated as the "current" one.
exports.getStats = async (req, res) => {
  try {
    let semester = null;

    if (req.query.semester !== undefined && req.query.semester !== '') {
      semester = Number(req.query.semester);
      if (!Number.isInteger(semester)) {
        return res.status(400).json({ success: false, message: 'Semester must be a whole number' });
      }
    }

    const [totalStudents, departments, avgResult, highest] = await Promise.all([
      Student.countDocuments(),
      Student.distinct('department'),
      Student.aggregate([
        { $match: { cgpa: { $ne: null } } },
        { $group: { _id: null, average: { $avg: '$cgpa' } } },
      ]),
      Student.findOne().sort({ semester: -1 }).select('semester').lean(),
    ]);

    if (semester === null && highest) semester = highest.semester;

    const studentsInSemester = semester === null ? 0 : await Student.countDocuments({ semester });

    res.json({
      success: true,
      data: {
        totalStudents,
        totalDepartments: departments.length,
        departments: departments.sort((a, b) => a.localeCompare(b)),
        averageCgpa: avgResult.length ? Number(avgResult[0].average.toFixed(2)) : 0,
        currentSemester: semester,
        studentsInSemester,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
};
