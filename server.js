const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

// Import timetable and exam scheduling modules
const { generateTimetableWithSemesterSplit, timeSlots, days } = require('./config/timetableGenerator');
const { generateExamSchedule } = require('./config/examScheduler');

const app = express();
const PORT = 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/timetable', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Error:', err));

// Schemas
const courseSchema = new mongoose.Schema({
  code: String,
  name: String,
  faculty: String,
  duration: Number,
  type: String,
  branch: String,
  year: Number,
  section: { type: String, default: '' },
  credits: { type: Number, default: 3 },
  semesterHalf: { type: String, default: '0' },
  combinedSections: { type: String, default: '' }
});

const facultySchema = new mongoose.Schema({
  name: String,
  department: String,
  availability: [String]
});

const roomSchema = new mongoose.Schema({
  number: String,
  capacity: Number,
  type: String
});

const timetableSchema = new mongoose.Schema({
  day: String,
  timeSlot: String,
  course: String,
  faculty: String,
  room: String,
  type: String,
  branch: String,
  year: Number,
  section: String,
  semesterHalf: String,
  isCombined: { type: Boolean, default: false },
  generatedAt: { type: Date, default: Date.now }
});

const examSchema = new mongoose.Schema({
  date: String,
  day: String,
  timeSlot: String,
  courseCode: String,
  courseName: String,
  credits: Number,
  branch: String,
  year: Number,
  students: mongoose.Schema.Types.Mixed,
  invigilators: [String],
  rooms: [String],
  roomInvigilatorPairs: [{
    room: String,
    invigilator: String
  }],
  generatedAt: { type: Date, default: Date.now }
});

const examCourseSchema = new mongoose.Schema({
  code: String,
  name: String,
  credits: String,
  branch: String,
  year: Number,
  students: String,
  type: String,
  faculty: String
});

// Simplified Invigilator Schema - just name
const invigilatorSchema = new mongoose.Schema({
  name: String
});

// Models
const Course = mongoose.model('Course', courseSchema);
const Faculty = mongoose.model('Faculty', facultySchema);
const Room = mongoose.model('Room', roomSchema);
const Timetable = mongoose.model('Timetable', timetableSchema);
const ExamSchedule = mongoose.model('ExamSchedule', examSchema);
const Invigilator = mongoose.model('Invigilator', invigilatorSchema);
const ExamCourse = mongoose.model('ExamCourse', examCourseSchema);

// File Upload Setup
const upload = multer({ dest: 'uploads/' });

// ==================== ROUTES ====================

// Home Route
app.get('/', (req, res) => {
  res.render('index');
});

// ==================== TIMETABLE ROUTES ====================

// Upload Courses
app.post('/upload/courses', upload.single('file'), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      const cleanData = {
        code: data.code ? data.code.trim() : '',
        name: data.name ? data.name.trim() : '',
        faculty: data.faculty ? data.faculty.trim() : '',
        duration: parseInt(data.duration) || 1,
        type: data.type ? data.type.trim() : 'Lecture',
        branch: data.branch ? data.branch.trim() : '',
        year: parseInt(data.year) || 1,
        section: data.section ? data.section.trim().toUpperCase() : '',
        credits: parseFloat(data.credits) || 3,
        semesterHalf: data.semesterHalf ? data.semesterHalf.trim() : '0',
        combinedSections: data.combinedSections ? data.combinedSections.trim() : ''
      };
      results.push(cleanData);
    })
    .on('end', async () => {
      await Course.deleteMany({});
      await Course.insertMany(results);
      fs.unlinkSync(req.file.path);
      
      const combinedCount = results.filter(c => c.combinedSections && c.combinedSections.length > 0).length;
      
      res.json({ 
        message: 'Courses uploaded successfully', 
        count: results.length,
        combinedSectionCourses: combinedCount
      });
    });
});

// Upload Faculty
app.post('/upload/faculty', upload.single('file'), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      await Faculty.deleteMany({});
      await Faculty.insertMany(results);
      fs.unlinkSync(req.file.path);
      res.json({ message: 'Faculty uploaded successfully', count: results.length });
    });
});

// Upload Rooms
app.post('/upload/rooms', upload.single('file'), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      const cleanData = {
        number: data.number ? data.number.trim() : '',
        capacity: parseInt(data.capacity) || 0,
        type: data.type ? data.type.trim() : 'Classroom'
      };
      results.push(cleanData);
    })
    .on('end', async () => {
      await Room.deleteMany({});
      await Room.insertMany(results);
      fs.unlinkSync(req.file.path);
      
      const largeRooms = results.filter(r => parseInt(r.capacity) >= 200).length;
      
      res.json({ 
        message: 'Rooms uploaded successfully', 
        count: results.length,
        largeRooms: largeRooms
      });
    });
});

// Generate Timetable
app.post('/generate', async (req, res) => {
  try {
    const courses = await Course.find();
    const faculty = await Faculty.find();
    const rooms = await Room.find();

    if (courses.length === 0 || faculty.length === 0 || rooms.length === 0) {
      return res.json({ error: 'Please upload all required data first' });
    }

    const combinedCourses = courses.filter(c => c.combinedSections && c.combinedSections.length > 0);
    const largeRooms = rooms.filter(r => parseInt(r.capacity) >= 200);
    
    if (combinedCourses.length > 0 && largeRooms.length === 0) {
      console.warn('⚠️ Warning: Combined section courses found but no 240-seater rooms available!');
    }

    const timetables = generateTimetableWithSemesterSplit(courses, faculty, rooms);
    
    await Timetable.deleteMany({});
    await Timetable.insertMany(timetables);

    const combinedEntries = timetables.filter(t => t.isCombined).length;

    res.json({ 
      message: 'Timetables generated successfully', 
      entries: timetables.length,
      firstHalf: timetables.filter(t => t.semesterHalf === 'First_Half').length,
      secondHalf: timetables.filter(t => t.semesterHalf === 'Second_Half').length,
      combinedSectionEntries: combinedEntries
    });
  } catch (error) {
    console.error('Error generating timetable:', error);
    res.json({ error: error.message });
  }
});

// View Timetable
app.get('/view', async (req, res) => {
  try {
    const timetable = await Timetable.find().sort({ branch: 1, year: 1, section: 1, semesterHalf: 1, day: 1 });
    
    const groupedByBranchYear = {};
    
    timetable.forEach(entry => {
      if (!entry.branch || !entry.year) {
        return;
      }
      
      const section = entry.section || '';
      const key = section ? 
        `${entry.branch}-${section}-Year${entry.year}-${entry.semesterHalf}` :
        `${entry.branch}-Year${entry.year}-${entry.semesterHalf}`;
      
      if (!groupedByBranchYear[key]) {
        groupedByBranchYear[key] = {
          branch: entry.branch,
          year: entry.year,
          section: section,
          semesterHalf: entry.semesterHalf,
          entries: []
        };
      }
      groupedByBranchYear[key].entries.push(entry);
    });
    
    res.render('timetable', { 
      timetable, 
      days, 
      timeSlots, 
      groupedByBranchYear 
    });
  } catch (error) {
    console.error('Error in /view route:', error);
    res.render('timetable', { 
      timetable: [], 
      days, 
      timeSlots, 
      groupedByBranchYear: {} 
    });
  }
});

// View Faculty Timetable
app.get('/view-faculty', async (req, res) => {
  try {
    const timetable = await Timetable.find().sort({ faculty: 1, semesterHalf: 1, day: 1 });
    
    const facultyTimetables = {};
    
    timetable.forEach(entry => {
      if (!entry.faculty) return;
      
      const faculties = entry.faculty.split('/').map(f => f.trim());
      
      faculties.forEach(faculty => {
        if (!facultyTimetables[faculty]) {
          facultyTimetables[faculty] = {
            name: faculty,
            First_Half: [],
            Second_Half: []
          };
        }
        
        facultyTimetables[faculty][entry.semesterHalf].push(entry);
      });
    });
    
    res.render('faculty-timetable', { 
      facultyTimetables, 
      days, 
      timeSlots 
    });
  } catch (error) {
    console.error('Error in /view-faculty route:', error);
    res.render('faculty-timetable', { 
      facultyTimetables: {}, 
      days, 
      timeSlots 
    });
  }
});

// Download Timetable CSV
app.get('/download', async (req, res) => {
  const timetable = await Timetable.find().sort({ branch: 1, year: 1, section: 1, semesterHalf: 1, day: 1 });
  
  let csvContent = 'Branch,Section,Year,Semester Half,Day,Time Slot,Course,Faculty,Room,Type,Combined\n';
  timetable.forEach(entry => {
    const combined = entry.isCombined ? 'Yes' : 'No';
    csvContent += `${entry.branch},${entry.section || ''},${entry.year},${entry.semesterHalf},${entry.day},${entry.timeSlot},"${entry.course}",${entry.faculty},${entry.room},${entry.type},${combined}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=timetable.csv');
  res.send(csvContent);
});

// Download Faculty Timetable CSV
app.get('/download-faculty', async (req, res) => {
  const timetable = await Timetable.find().sort({ faculty: 1, semesterHalf: 1, day: 1 });
  
  let csvContent = 'Faculty,Semester Half,Day,Time Slot,Course,Branch,Year,Room,Type,Combined\n';
  
  const facultyEntries = [];
  timetable.forEach(entry => {
    if (!entry.faculty) return;
    
    const faculties = entry.faculty.split('/').map(f => f.trim());
    faculties.forEach(faculty => {
      facultyEntries.push({
        faculty,
        semesterHalf: entry.semesterHalf,
        day: entry.day,
        timeSlot: entry.timeSlot,
        course: entry.course,
        branch: entry.branch,
        year: entry.year,
        room: entry.room,
        type: entry.type,
        combined: entry.isCombined ? 'Yes' : 'No'
      });
    });
  });
  
  facultyEntries.sort((a, b) => {
    if (a.faculty !== b.faculty) return a.faculty.localeCompare(b.faculty);
    if (a.semesterHalf !== b.semesterHalf) return a.semesterHalf.localeCompare(b.semesterHalf);
    return a.day.localeCompare(b.day);
  });
  
  facultyEntries.forEach(entry => {
    csvContent += `${entry.faculty},${entry.semesterHalf},${entry.day},${entry.timeSlot},"${entry.course}",${entry.branch},${entry.year},${entry.room},${entry.type},${entry.combined}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=faculty-timetable.csv');
  res.send(csvContent);
});


// ==================== EXAM SCHEDULING ROUTES ====================

// Exam Upload Page
app.get('/exam', (req, res) => {
  res.render('exam-upload');
});

// Upload Exam Courses
app.post('/upload/exam-courses', upload.single('file'), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      const cleanData = {
        code: data.code ? data.code.trim() : '',
        name: data.name ? data.name.trim() : '',
        credits: data.credits || 3,
        branch: data.branch ? data.branch.trim().toUpperCase() : '',
        year: parseInt(data.year) || 1,
        students: data.students || '60',
        type: data.type ? data.type.trim() : 'Theory',
        faculty: data.faculty ? data.faculty.trim() : 'TBA'
      };
      results.push(cleanData);
    })
    .on('end', async () => {
      await ExamCourse.deleteMany({});
      await ExamCourse.insertMany(results);
      fs.unlinkSync(req.file.path);
      
      const theoryCourses = results.filter(c => 
        !c.type.toLowerCase().includes('lab')
      ).length;
      
      res.json({ 
        message: 'Exam courses uploaded successfully', 
        count: results.length,
        theoryCourses: theoryCourses
      });
    });
});

// Upload Invigilators - SIMPLIFIED VERSION (just names)
app.post('/upload/invigilators', upload.single('file'), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      // Support both simple format (just 'name' column) and old format
      const cleanData = {
        name: data.name || data.Name || data.NAME || ''
      };
      if (cleanData.name.trim()) {
        results.push(cleanData);
      }
    })
    .on('end', async () => {
      await Invigilator.deleteMany({});
      await Invigilator.insertMany(results);
      fs.unlinkSync(req.file.path);
      res.json({ 
        message: 'Invigilators uploaded successfully', 
        count: results.length 
      });
    });
});

// Upload Exam Rooms
app.post('/upload/exam-rooms', upload.single('file'), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      const cleanData = {
        number: data.number ? data.number.trim() : '',
        capacity: parseInt(data.capacity) || 40,
        type: data.type ? data.type.trim() : 'Classroom'
      };
      results.push(cleanData);
    })
    .on('end', async () => {
      await Room.deleteMany({});
      await Room.insertMany(results);
      fs.unlinkSync(req.file.path);
      res.json({ message: 'Exam rooms uploaded successfully', count: results.length });
    });
});

// Generate Exam Schedule with Date Range
app.post('/generate-exam', async (req, res) => {
  try {
    const { startDate, endDate, timeSlot1, timeSlot2 } = req.body;
    
    console.log('\n=== Exam Schedule Generation Request ===');
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);
    console.log('Time Slot 1:', timeSlot1);
    console.log('Time Slot 2:', timeSlot2);
    
    if (!startDate || !endDate) {
      return res.json({ error: 'Start date and end date are required' });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.json({ error: 'Invalid date format' });
    }
    
    if (start > end) {
      return res.json({ error: 'Start date must be before or equal to end date' });
    }
    
    const examCourses = await ExamCourse.find();
    const invigilators = await Invigilator.find();
    const rooms = await Room.find();

    if (examCourses.length === 0 || invigilators.length === 0 || rooms.length === 0) {
      return res.json({ error: 'Please upload all required data first' });
    }

    console.log(`Courses: ${examCourses.length}, Invigilators: ${invigilators.length}, Rooms: ${rooms.length}`);

    // Pass invigilators directly (they're just objects with 'name' property)
    const examSchedule = generateExamSchedule(
      examCourses, 
      invigilators,  // Array of {name: "Dr. X"} objects
      rooms,
      startDate,
      endDate,
      timeSlot1 || '09:00 - 12:00',
      timeSlot2 || null
    );
    
    await ExamSchedule.deleteMany({});
    await ExamSchedule.insertMany(examSchedule);

    console.log(`\n✅ Exam schedule generated: ${examSchedule.length} exams`);

    res.json({ 
      message: `Exam schedule generated successfully for ${startDate} to ${endDate}`, 
      entries: examSchedule.length,
      startDate: startDate,
      endDate: endDate
    });
  } catch (error) {
    console.error('Error generating exam schedule:', error);
    res.json({ error: error.message });
  }
});

// View Exam Schedule
app.get('/view-exam', async (req, res) => {
  try {
    const examSchedule = await ExamSchedule.find().sort({ branch: 1, year: 1, date: 1 });
    
    const groupedByBranch = {};
    
    examSchedule.forEach(exam => {
      const branch = exam.branch || 'Unknown';
      
      if (!groupedByBranch[branch]) {
        groupedByBranch[branch] = {
          branch: branch,
          exams: []
        };
      }
      groupedByBranch[branch].exams.push(exam);
    });

    res.render('exam-schedule', { groupedByBranch });
  } catch (error) {
    console.error('Error fetching exam schedule:', error);
    res.render('exam-schedule', { groupedByBranch: {} });
  }
});

// Download Exam Schedule CSV
app.get('/download-exam', async (req, res) => {
  const examSchedule = await ExamSchedule.find().sort({ branch: 1, year: 1, date: 1 });
  
  let csvContent = 'Branch,Year,Date,Day,Time Slot,Course Code,Course Name,Credits,Students,Room,Invigilator\n';
  examSchedule.forEach(entry => {
    const roomInvPairs = entry.roomInvigilatorPairs || [];
    if (roomInvPairs.length > 0) {
      roomInvPairs.forEach(pair => {
        csvContent += `${entry.branch},${entry.year},${entry.date},${entry.day},${entry.timeSlot},${entry.courseCode},"${entry.courseName}",${entry.credits},${entry.students},${pair.room},${pair.invigilator}\n`;
      });
    } else {
      csvContent += `${entry.branch},${entry.year},${entry.date},${entry.day},${entry.timeSlot},${entry.courseCode},"${entry.courseName}",${entry.credits},${entry.students},"${entry.rooms.join(', ')}","${entry.invigilators.join(', ')}"\n`;
    }
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=exam-schedule.csv');
  res.send(csvContent);
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});