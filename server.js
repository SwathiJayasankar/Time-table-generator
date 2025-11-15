const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

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
  section: { type: String, default: '' }, // Section: A, B, or empty for single section
  credits: { type: Number, default: 3 },
  semesterHalf: { type: String, default: '0' }
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
  students: mongoose.Schema.Types.Mixed,
  invigilators: [String],
  rooms: [String],
  generatedAt: { type: Date, default: Date.now }
});

const invigilatorSchema = new mongoose.Schema({
  name: String,
  department: String,
  availability: [String]
});

const examCourseSchema = new mongoose.Schema({
  code: String,
  name: String,
  credits: String,
  branch: String,
  students: String,
  type: String
});

const Course = mongoose.model('Course', courseSchema);
const Faculty = mongoose.model('Faculty', facultySchema);
const Room = mongoose.model('Room', roomSchema);
const Timetable = mongoose.model('Timetable', timetableSchema);
const ExamSchedule = mongoose.model('ExamSchedule', examSchema);
const Invigilator = mongoose.model('Invigilator', invigilatorSchema);
const ExamCourse = mongoose.model('ExamCourse', examCourseSchema);

// File Upload Setup
const upload = multer({ dest: 'uploads/' });

// Time Slots - excluding breaks
const timeSlots = [
  '09:00 - 10:00',
  '10:00 - 10:30',
  '10:45 - 11:00',
  '11:00 - 12:00',
  '12:00 - 12:15',
  '12:15 - 12:30',
  '12:30 - 13:15',
  '14:00 - 14:30',
  '14:30 - 15:30',
  '15:30 - 15:40',
  '15:40 - 16:00',
  '16:00 - 16:30',
  '16:30 - 17:10',
  '17:10 - 17:30',
  '17:30 - 18:30'
];

const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

// Helper function to calculate duration of a time slot in minutes
function getSlotDuration(slot) {
  const [start, end] = slot.split(' - ');
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return endMinutes - startMinutes;
}

// Define continuous time blocks (avoiding breaks)
function getContinuousTimeBlocks() {
  return [
    {
      name: 'morning',
      slots: [
        '09:00 - 10:00',
        '10:00 - 10:30'
      ]
    },
    {
      name: 'late-morning',
      slots: [
        '10:45 - 11:00',
        '11:00 - 12:00',
        '12:00 - 12:15',
        '12:15 - 12:30',
        '12:30 - 13:15'
      ]
    },
    {
      name: 'afternoon',
      slots: [
        '14:00 - 14:30',
        '14:30 - 15:30',
        '15:30 - 15:40',
        '15:40 - 16:00',
        '16:00 - 16:30',
        '16:30 - 17:10',
        '17:10 - 17:30',
        '17:30 - 18:30'
      ]
    }
  ];
}

// Find consecutive slots within continuous blocks that match target duration
function findSlotsForDuration(targetMinutes) {
  const blocks = getContinuousTimeBlocks();
  const validCombinations = [];
  
  blocks.forEach(block => {
    for (let startIdx = 0; startIdx < block.slots.length; startIdx++) {
      let totalMinutes = 0;
      const selectedSlots = [];
      
      for (let i = startIdx; i < block.slots.length; i++) {
        const slot = block.slots[i];
        const duration = getSlotDuration(slot);
        selectedSlots.push(slot);
        totalMinutes += duration;
        
        if (Math.abs(totalMinutes - targetMinutes) <= 5) {
          validCombinations.push({
            slots: [...selectedSlots],
            totalMinutes: totalMinutes,
            block: block.name
          });
          break;
        }
        
        if (totalMinutes > targetMinutes + 5) {
          break;
        }
      }
    }
  });
  
  return validCombinations;
}

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

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
        semesterHalf: data.semesterHalf ? data.semesterHalf.trim() : '0'
      };
      results.push(cleanData);
    })
    .on('end', async () => {
      await Course.deleteMany({});
      await Course.insertMany(results);
      fs.unlinkSync(req.file.path);
      res.json({ message: 'Courses uploaded successfully', count: results.length });
    });
});

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

app.post('/upload/rooms', upload.single('file'), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      await Room.deleteMany({});
      await Room.insertMany(results);
      fs.unlinkSync(req.file.path);
      res.json({ message: 'Rooms uploaded successfully', count: results.length });
    });
});

app.post('/generate', async (req, res) => {
  try {
    const courses = await Course.find();
    const faculty = await Faculty.find();
    const rooms = await Room.find();

    if (courses.length === 0 || faculty.length === 0 || rooms.length === 0) {
      return res.json({ error: 'Please upload all required data first' });
    }

    const timetables = generateTimetableWithSemesterSplit(courses, faculty, rooms);
    
    await Timetable.deleteMany({});
    await Timetable.insertMany(timetables);

    res.json({ 
      message: 'Timetables generated successfully', 
      entries: timetables.length,
      firstHalf: timetables.filter(t => t.semesterHalf === 'First_Half').length,
      secondHalf: timetables.filter(t => t.semesterHalf === 'Second_Half').length
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

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

app.get('/download', async (req, res) => {
  const timetable = await Timetable.find().sort({ branch: 1, year: 1, section: 1, semesterHalf: 1, day: 1 });
  
  let csvContent = 'Branch,Section,Year,Semester Half,Day,Time Slot,Course,Faculty,Room,Type\n';
  timetable.forEach(entry => {
    csvContent += `${entry.branch},${entry.section || ''},${entry.year},${entry.semesterHalf},${entry.day},${entry.timeSlot},${entry.course},${entry.faculty},${entry.room},${entry.type}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=timetable.csv');
  res.send(csvContent);
});

app.get('/download-faculty', async (req, res) => {
  const timetable = await Timetable.find().sort({ faculty: 1, semesterHalf: 1, day: 1 });
  
  let csvContent = 'Faculty,Semester Half,Day,Time Slot,Course,Branch,Year,Room,Type\n';
  
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
        type: entry.type
      });
    });
  });
  
  facultyEntries.sort((a, b) => {
    if (a.faculty !== b.faculty) return a.faculty.localeCompare(b.faculty);
    if (a.semesterHalf !== b.semesterHalf) return a.semesterHalf.localeCompare(b.semesterHalf);
    return a.day.localeCompare(b.day);
  });
  
  facultyEntries.forEach(entry => {
    csvContent += `${entry.faculty},${entry.semesterHalf},${entry.day},${entry.timeSlot},${entry.course},${entry.branch},${entry.year},${entry.room},${entry.type}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=faculty-timetable.csv');
  res.send(csvContent);
});

// Exam Scheduling Routes
app.get('/exam', (req, res) => {
  res.render('exam-upload');
});

app.post('/upload/exam-courses', upload.single('file'), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      await ExamCourse.deleteMany({});
      await ExamCourse.insertMany(results);
      fs.unlinkSync(req.file.path);
      res.json({ message: 'Exam courses uploaded successfully', count: results.length });
    });
});

app.post('/upload/invigilators', upload.single('file'), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      await Invigilator.deleteMany({});
      await Invigilator.insertMany(results);
      fs.unlinkSync(req.file.path);
      res.json({ message: 'Invigilators uploaded successfully', count: results.length });
    });
});

app.post('/upload/exam-rooms', upload.single('file'), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      await Room.deleteMany({});
      await Room.insertMany(results);
      fs.unlinkSync(req.file.path);
      res.json({ message: 'Exam rooms uploaded successfully', count: results.length });
    });
});

app.post('/generate-exam', async (req, res) => {
  try {
    const examCourses = await ExamCourse.find();
    const invigilators = await Invigilator.find();
    const rooms = await Room.find();

    if (examCourses.length === 0 || invigilators.length === 0 || rooms.length === 0) {
      return res.json({ error: 'Please upload all required data first' });
    }

    const examSchedule = generateExamSchedule(examCourses, invigilators, rooms);
    
    await ExamSchedule.deleteMany({});
    await ExamSchedule.insertMany(examSchedule);

    res.json({ message: 'Exam schedule generated successfully', entries: examSchedule.length });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get('/view-exam', async (req, res) => {
  try {
    const examSchedule = await ExamSchedule.find().sort({ branch: 1, date: 1 });
    
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

app.get('/download-exam', async (req, res) => {
  const examSchedule = await ExamSchedule.find().sort({ branch: 1, date: 1 });
  
  let csvContent = 'Branch,Date,Day,Time Slot,Course Code,Course Name,Room,Invigilator\n';
  examSchedule.forEach(entry => {
    const roomInvPairs = entry.roomInvigilatorPairs || [];
    if (roomInvPairs.length > 0) {
      roomInvPairs.forEach(pair => {
        csvContent += `${entry.branch},${entry.date},${entry.day},${entry.timeSlot},${entry.courseCode},"${entry.courseName}",${pair.room},${pair.invigilator}\n`;
      });
    } else {
      csvContent += `${entry.branch},${entry.date},${entry.day},${entry.timeSlot},${entry.courseCode},"${entry.courseName}","${entry.rooms.join(', ')}","${entry.invigilators.join(', ')}"\n`;
    }
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=exam-schedule.csv');
  res.send(csvContent);
});


// ============= FIXED SEMESTER SPLIT LOGIC WITH CSV NORMALIZATION =============
function generateTimetableWithSemesterSplit(courses, faculty, rooms) {
  const allTimetables = [];
  
  console.log('\n=== Analyzing Course Data ===');
  console.log(`Total courses loaded: ${courses.length}`);
  
  // Normalize all course data (CRITICAL for CSV parsing)
  courses.forEach(c => {
    // Normalize semesterHalf
    if (c.semesterHalf !== undefined && c.semesterHalf !== null) {
      c.semesterHalf = String(c.semesterHalf).trim();
    } else {
      c.semesterHalf = '0';
    }
    
    // Normalize credits
    if (typeof c.credits === 'string') {
      c.credits = parseFloat(c.credits) || 3;
    } else if (typeof c.credits !== 'number') {
      c.credits = 3;
    }
    
    // Normalize other fields
    c.code = (c.code || '').trim();
    c.name = (c.name || '').trim();
    c.faculty = (c.faculty || '').trim();
    c.type = (c.type || 'Lecture').trim();
    c.branch = (c.branch || '').trim();
    c.year = parseInt(c.year) || 1;
    c.section = c.section ? String(c.section).trim().toUpperCase() : '';
  });
  
  // Show sample data for debugging
  const sampleCourse = courses[0];
  if (sampleCourse) {
    console.log('Sample normalized course:', {
      code: sampleCourse.code,
      semesterHalf: `"${sampleCourse.semesterHalf}"`,
      credits: sampleCourse.credits,
      type: sampleCourse.type
    });
  }
  
  // Count courses by semesterHalf value
  const semHalfCounts = {};
  courses.forEach(c => {
    const key = c.semesterHalf;
    semHalfCounts[key] = (semHalfCounts[key] || 0) + 1;
  });
  console.log('Courses by semesterHalf:', semHalfCounts);
  
  // First Half: semesterHalf = '1' OR (semesterHalf = '0' AND credits >= 3)
  const firstHalfCourses = courses.filter(c => {
    const semHalf = c.semesterHalf;
    const credits = c.credits;
    
    if (semHalf === '1') return true;
    if (semHalf === '0' && credits >= 3) return true;
    return false;
  });
  
  // Second Half: semesterHalf = '2' OR (semesterHalf = '0' AND credits < 3)
  const secondHalfCourses = courses.filter(c => {
    const semHalf = c.semesterHalf;
    const credits = c.credits;
    
    if (semHalf === '2') return true;
    if (semHalf === '0' && credits < 3) return true;
    return false;
  });
  
  console.log('\n=== Course Distribution ===');
  console.log(`First Half courses: ${firstHalfCourses.length}`);
  console.log(`Second Half courses: ${secondHalfCourses.length}`);
  console.log(`Total scheduled: ${firstHalfCourses.length + secondHalfCourses.length}`);
  
  // Show breakdown by branch for verification
  const firstByBranch = {};
  const secondByBranch = {};
  
  firstHalfCourses.forEach(c => {
    const key = `${c.branch}-Y${c.year}`;
    firstByBranch[key] = (firstByBranch[key] || 0) + 1;
  });
  
  secondHalfCourses.forEach(c => {
    const key = `${c.branch}-Y${c.year}`;
    secondByBranch[key] = (secondByBranch[key] || 0) + 1;
  });
  
  console.log('\nFirst Half by branch-year:', firstByBranch);
  console.log('Second Half by branch-year:', secondByBranch);
  
  console.log(`\n=== First Half Details (showing first 10) ===`);
  firstHalfCourses.slice(0, 10).forEach(c => {
    console.log(`  ${c.code} | ${c.branch} Y${c.year}${c.section ? '-'+c.section : ''} | Credits:${c.credits} | SemHalf:"${c.semesterHalf}" | ${c.type}`);
  });
  
  console.log(`\n=== Second Half Details (showing first 10) ===`);
  secondHalfCourses.slice(0, 10).forEach(c => {
    console.log(`  ${c.code} | ${c.branch} Y${c.year}${c.section ? '-'+c.section : ''} | Credits:${c.credits} | SemHalf:"${c.semesterHalf}" | ${c.type}`);
  });
  
  // Generate timetables
  console.log('\n=== Starting First Half Generation ===');
  const firstHalfTimetable = generateTimetableForHalf(firstHalfCourses, faculty, rooms, 'First_Half');
  allTimetables.push(...firstHalfTimetable);
  
  console.log('\n=== Starting Second Half Generation ===');
  const secondHalfTimetable = generateTimetableForHalf(secondHalfCourses, faculty, rooms, 'Second_Half');
  allTimetables.push(...secondHalfTimetable);
  
  console.log(`\n=== Generation Summary ===`);
  console.log(`First Half entries created: ${firstHalfTimetable.length}`);
  console.log(`Second Half entries created: ${secondHalfTimetable.length}`);
  console.log(`Total timetable entries: ${allTimetables.length}`);
  
  return allTimetables;
}

// ============= IMPROVED LAB SCHEDULING =============
function generateTimetableForHalf(courses, faculty, rooms, semesterHalf) {
  const timetable = [];
  const facultySchedule = {};
  const roomSchedule = {};
  const branchYearSectionSchedule = {};
  const courseSchedule = {};

  const coursesByBranchYearSection = {};
  courses.forEach(course => {
    if (!course.branch || !course.year) {
      return;
    }
    
    const section = course.section || '';
    const key = section ? `${course.branch}-${course.year}-${section}` : `${course.branch}-${course.year}`;
    if (!coursesByBranchYearSection[key]) {
      coursesByBranchYearSection[key] = [];
    }
    coursesByBranchYearSection[key].push(course);
  });

  console.log(`\n=== Generating ${semesterHalf} Timetable ===`);
  console.log('Found combinations:', Object.keys(coursesByBranchYearSection));
  
  const sortedKeys = Object.keys(coursesByBranchYearSection).sort();
  
  sortedKeys.forEach(branchYearSectionKey => {
    const parts = branchYearSectionKey.split('-');
    const branch = parts[0];
    const year = parts[1];
    const section = parts[2] || '';
    
    const branchCourses = coursesByBranchYearSection[branchYearSectionKey];
    
    const displayKey = section ? `${branch} Year ${year} Section ${section}` : `${branch} Year ${year}`;
    console.log(`\nProcessing ${displayKey}: ${branchCourses.length} courses`);

    branchYearSectionSchedule[branchYearSectionKey] = {};
    days.forEach(day => {
      branchYearSectionSchedule[branchYearSectionKey][day] = {};
    });

    const labCourses = branchCourses.filter(c => (c.type || '').toLowerCase().includes('lab'));
    const regularCourses = branchCourses.filter(c => !(c.type || '').toLowerCase().includes('lab'));

    console.log(`  Lab courses: ${labCourses.length}, Regular courses: ${regularCourses.length}`);

    const lecture90Combinations = findSlotsForDuration(90);
    const tutorial60Combinations = findSlotsForDuration(60);
    const lab120Combinations = findSlotsForDuration(120);

    console.log(`  Slot combinations available:`);
    console.log(`    - 90min lectures: ${lecture90Combinations.length} options`);
    console.log(`    - 60min tutorials: ${tutorial60Combinations.length} options`);
    console.log(`    - 120min labs: ${lab120Combinations.length} options`);

    // ===== PROCESS REGULAR COURSES =====
    regularCourses.forEach(course => {
      const courseKey = `${branchYearSectionKey}-${course.code}-${semesterHalf}`;
      courseSchedule[courseKey] = [];
      
      const sessionsNeeded = [
        { type: 'Lecture', duration: 90, sessionNum: 1, combinations: lecture90Combinations },
        { type: 'Lecture', duration: 90, sessionNum: 2, combinations: lecture90Combinations },
        { type: 'Tutorial', duration: 60, sessionNum: 1, combinations: tutorial60Combinations }
      ];

      sessionsNeeded.forEach(session => {
        let assigned = false;
        let attempts = 0;
        const maxAttempts = days.length * session.combinations.length * 3;

        while (!assigned && attempts < maxAttempts) {
          const availableDays = days.filter(d => !courseSchedule[courseKey].includes(d));
          
          if (availableDays.length === 0) {
            break;
          }

          const day = availableDays[Math.floor(Math.random() * availableDays.length)];
          const combination = session.combinations[Math.floor(Math.random() * session.combinations.length)];
          
          if (!combination) {
            attempts++;
            continue;
          }

          const slotsToUse = combination.slots;
          let selectedRoom;
          const classrooms = rooms.filter(r => (r.type || '').toLowerCase().includes('class'));
          selectedRoom = classrooms.length > 0 ? 
            classrooms[Math.floor(Math.random() * classrooms.length)] : rooms[0];

          let hasConflict = false;
          
          for (const slot of slotsToUse) {
            const facultyKey = `${course.faculty}-${day}-${slot}-${semesterHalf}`;
            const roomKey = `${selectedRoom.number}-${day}-${slot}-${semesterHalf}`;
            
            if (facultySchedule[facultyKey] || roomSchedule[roomKey] || 
                branchYearSectionSchedule[branchYearSectionKey][day][slot]) {
              hasConflict = true;
              break;
            }
          }

          if (!hasConflict) {
            slotsToUse.forEach((slot, idx) => {
              const sessionLabel = session.type === 'Tutorial' ? 
                'Tutorial' : `Lecture ${session.sessionNum}`;
              
              let courseName = `${course.name} - ${sessionLabel}`;
              
              if (slotsToUse.length > 1) {
                courseName += ` (${idx + 1}/${slotsToUse.length})`;
              }

              timetable.push({
                day,
                timeSlot: slot,
                course: courseName,
                faculty: course.faculty,
                room: selectedRoom.number,
                type: session.type,
                branch: course.branch,
                year: parseInt(course.year),
                section: section,
                semesterHalf: semesterHalf
              });

              facultySchedule[`${course.faculty}-${day}-${slot}-${semesterHalf}`] = true;
              roomSchedule[`${selectedRoom.number}-${day}-${slot}-${semesterHalf}`] = true;
              branchYearSectionSchedule[branchYearSectionKey][day][slot] = true;
            });

            courseSchedule[courseKey].push(day);
            assigned = true;
            console.log(`  ✓ ${course.code} ${session.type} ${session.sessionNum || ''} - ${day} ${slotsToUse[0]}`);
          }

          attempts++;
        }

        if (!assigned) {
          console.log(`  ✗ Could not assign ${course.code} ${session.type} ${session.sessionNum || ''}`);
        }
      });
    });

    // ===== IMPROVED LAB SCHEDULING =====
    console.log(`\n  === Starting Lab Allocation for ${displayKey} ===`);
    
    labCourses.forEach(course => {
      let assigned = false;
      let attempts = 0;
      const maxAttempts = days.length * 50; // Increased attempts

      console.log(`  Scheduling lab: ${course.code} - ${course.name}`);

      while (!assigned && attempts < maxAttempts) {
        const day = days[Math.floor(Math.random() * days.length)];
        
        let slotsToUse = [];
        let slotSource = 'none';
        let totalMinutes = 0;
        
        // Strategy 1: Try 120-minute combinations
        if (lab120Combinations.length > 0 && attempts < maxAttempts * 0.3) {
          const combination = lab120Combinations[Math.floor(Math.random() * lab120Combinations.length)];
          if (combination) {
            slotsToUse = combination.slots;
            totalMinutes = combination.totalMinutes;
            slotSource = '120min-combination';
          }
        }
        
        // Strategy 2: Try any 2-3 consecutive slots from continuous blocks
        if (slotsToUse.length === 0) {
          const blocks = getContinuousTimeBlocks();
          const selectedBlock = blocks[Math.floor(Math.random() * blocks.length)];
          
          if (selectedBlock.slots.length >= 2) {
            const startIdx = Math.floor(Math.random() * (selectedBlock.slots.length - 1));
            const numSlots = Math.min(3, selectedBlock.slots.length - startIdx);
            slotsToUse = selectedBlock.slots.slice(startIdx, startIdx + numSlots);
            
            // Calculate total minutes
            totalMinutes = 0;
            for (const slot of slotsToUse) {
              totalMinutes += getSlotDuration(slot);
            }
            slotSource = `${numSlots}-consecutive-slots`;
          }
        }
        
        // Strategy 3: Just take ANY 2 consecutive available slots
        if (slotsToUse.length === 0 && attempts > maxAttempts * 0.5) {
          const timeSlots = [
            '09:00 - 10:00', '10:00 - 10:30',
            '10:45 - 11:00', '11:00 - 12:00', '12:00 - 12:15', '12:15 - 12:30', '12:30 - 13:15',
            '14:00 - 14:30', '14:30 - 15:30', '15:30 - 15:40', '15:40 - 16:00', 
            '16:00 - 16:30', '16:30 - 17:10', '17:10 - 17:30', '17:30 - 18:30'
          ];
          const startIdx = Math.floor(Math.random() * (timeSlots.length - 1));
          slotsToUse = [timeSlots[startIdx], timeSlots[startIdx + 1]];
          
          // Calculate total minutes
          totalMinutes = 0;
          for (const slot of slotsToUse) {
            totalMinutes += getSlotDuration(slot);
          }
          slotSource = 'any-2-slots';
        }
        
        if (slotsToUse.length === 0) {
          attempts++;
          continue;
        }

        // Select lab room
        let selectedRoom;
        const labRooms = rooms.filter(r => (r.type || '').toLowerCase().includes('lab'));
        if (labRooms.length > 0) {
          selectedRoom = labRooms[Math.floor(Math.random() * labRooms.length)];
        } else {
          selectedRoom = rooms[Math.floor(Math.random() * rooms.length)];
        }

        // Check conflicts
        let hasConflict = false;
        for (const slot of slotsToUse) {
          const facultyKey = `${course.faculty}-${day}-${slot}-${semesterHalf}`;
          const roomKey = `${selectedRoom.number}-${day}-${slot}-${semesterHalf}`;
          
          if (facultySchedule[facultyKey] || roomSchedule[roomKey] || 
              branchYearSectionSchedule[branchYearSectionKey][day][slot]) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          // Assign lab slots
          slotsToUse.forEach((slot, idx) => {
            timetable.push({
              day,
              timeSlot: slot,
              course: `${course.name} (${idx + 1}/${slotsToUse.length})`,
              faculty: course.faculty,
              room: selectedRoom.number,
              type: 'Lab',
              branch: course.branch,
              year: parseInt(course.year),
              section: section,
              semesterHalf: semesterHalf
            });

            facultySchedule[`${course.faculty}-${day}-${slot}-${semesterHalf}`] = true;
            roomSchedule[`${selectedRoom.number}-${day}-${slot}-${semesterHalf}`] = true;
            branchYearSectionSchedule[branchYearSectionKey][day][slot] = true;
          });

          assigned = true;
          console.log(`  ✓ ${course.code} Lab - ${day} ${slotsToUse[0]} (${slotsToUse.length} slots = ${totalMinutes}min, method: ${slotSource})`);
        }

        attempts++;
      }

      if (!assigned) {
        console.log(`  ✗✗✗ FAILED to assign ${course.code} Lab after ${attempts} attempts`);
        console.log(`      Faculty: ${course.faculty}, Room type needed: Lab`);
        console.log(`      Reason: Could not find consecutive free slots`);
      }
    });
  });

  return timetable;
}



function generateExamSchedule(examCourses, invigilators, rooms) {
  const examSchedule = [];
  const invigilatorSchedule = {};
  const roomSchedule = {};
  const branchDateUsage = {};
  
  const examDates = [
    { date: '20-Nov-2025', day: 'Thursday' },
    { date: '21-Nov-2025', day: 'Friday' },
    { date: '22-Nov-2025', day: 'Saturday' },
    { date: '24-Nov-2025', day: 'Monday' },
    { date: '25-Nov-2025', day: 'Tuesday' },
    { date: '26-Nov-2025', day: 'Wednesday' },
    { date: '27-Nov-2025', day: 'Thursday' },
    { date: '28-Nov-2025', day: 'Friday' },
    { date: '29-Nov-2025', day: 'Saturday' }
  ];
  
  const examSlots = [
    { slot: 'FN: 09:00 AM to 10:30 AM', priority: 1 },
    { slot: 'AN: 03:00 PM to 04:30 PM', priority: 2 }
  ];

  const theoryCourses = examCourses.filter(course => {
    const type = (course.type || '').toLowerCase();
    return !type.includes('lab') && !type.includes('practical');
  });

  const coursesByBranch = {};
  theoryCourses.forEach(course => {
    const branch = course.branch || 'Unknown';
    if (!coursesByBranch[branch]) {
      coursesByBranch[branch] = [];
    }
    coursesByBranch[branch].push(course);
  });

  console.log('\n=== Scheduling Exams Branch-wise ===');
  
  Object.keys(coursesByBranch).sort().forEach(branch => {
    const courses = coursesByBranch[branch];
    
    console.log(`Processing ${branch}: ${courses.length} courses`);

    courses.sort((a, b) => {
      const studentsA = parseInt(a.students) || 30;
      const studentsB = parseInt(b.students) || 30;
      return studentsB - studentsA;
    });

    let dateIndex = 0;

    courses.forEach(course => {
      let assigned = false;
      let attempts = 0;
      const maxAttempts = examDates.length * examSlots.length;

      let studentsCount = 30;
      if (course.students && course.students.toLowerCase() !== 'all') {
        studentsCount = parseInt(course.students) || 30;
      }
      
      const roomsNeeded = Math.ceil(studentsCount / 40);
      const invigilatorsNeeded = roomsNeeded;

      while (!assigned && attempts < maxAttempts) {
        const currentDateIndex = (dateIndex + Math.floor(attempts / examSlots.length)) % examDates.length;
        const slotIndex = attempts % examSlots.length;
        
        const examDate = examDates[currentDateIndex];
        const examSlot = examSlots[slotIndex];
        
        const scheduleKey = `${examDate.date}-${examSlot.slot}`;
        const branchDateKey = `${branch}-${examDate.date}`;

        if (branchDateUsage[branchDateKey]) {
          attempts++;
          continue;
        }

        const availableRooms = [];
        for (let room of rooms) {
          const roomKey = `${room.number}-${scheduleKey}`;
          if (!roomSchedule[roomKey]) {
            availableRooms.push(room);
            if (availableRooms.length >= roomsNeeded) break;
          }
        }

        const availableInvigilators = [];
        for (let inv of invigilators) {
          const invKey = `${inv.name}-${scheduleKey}`;
          if (!invigilatorSchedule[invKey]) {
            availableInvigilators.push(inv);
            if (availableInvigilators.length >= invigilatorsNeeded) break;
          }
        }

        if (availableRooms.length >= roomsNeeded && 
            availableInvigilators.length >= invigilatorsNeeded) {
          
          const assignedRooms = availableRooms.slice(0, roomsNeeded);
          assignedRooms.forEach(room => {
            const roomKey = `${room.number}-${scheduleKey}`;
            roomSchedule[roomKey] = true;
          });

          const assignedInvigilators = availableInvigilators.slice(0, invigilatorsNeeded);
          assignedInvigilators.forEach(inv => {
            const invKey = `${inv.name}-${scheduleKey}`;
            invigilatorSchedule[invKey] = true;
          });

          branchDateUsage[branchDateKey] = true;

          const roomInvigilatorPairs = [];
          assignedRooms.forEach((room, idx) => {
            const inv = assignedInvigilators[idx];
            roomInvigilatorPairs.push({
              room: room.number,
              invigilator: inv?.name || 'TBD'
            });
          });

          examSchedule.push({
            date: examDate.date,
            day: examDate.day,
            timeSlot: examSlot.slot,
            courseCode: course.code,
            courseName: course.name,
            credits: parseInt(course.credits) || 0,
            branch: branch,
            students: course.students && course.students.toLowerCase() === 'all' ? 'All' : studentsCount,
            invigilators: assignedInvigilators.map(inv => inv.name),
            rooms: assignedRooms.map(room => room.number),
            roomInvigilatorPairs: roomInvigilatorPairs,
            type: course.type || 'Theory'
          });

          console.log(`  ✓ ${course.code} scheduled on ${examDate.date} ${examSlot.slot}`);
          assigned = true;
          dateIndex++;
        }

        attempts++;
      }

      if (!assigned) {
        console.log(`  ✗ Could not assign ${course.code} - ${course.name}`);
      }
    });
  });

  console.log(`\n=== Summary ===`);
  console.log(`Total exams scheduled: ${examSchedule.length}`);
  
  return examSchedule;
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});