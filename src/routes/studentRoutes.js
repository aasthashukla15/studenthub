// Routes: connect each URL + HTTP method to a controller function
const express = require('express');
const controller = require('../controllers/studentController');

const router = express.Router();

// Reject IDs that are not a valid 24-character MongoDB ObjectId before touching the database
function checkId(req, res, next) {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid student ID' });
  }
  next();
}

router.post('/students', controller.createStudent); //          Create
router.get('/students', controller.getStudents); //             Read all (search + filters)
router.get('/students/:id', checkId, controller.getStudentById); // Read one
router.put('/students/:id', checkId, controller.updateStudent); //  Update
router.delete('/students/:id', checkId, controller.deleteStudent); // Delete

router.get('/stats', controller.getStats); //                   Dashboard statistics

module.exports = router;
