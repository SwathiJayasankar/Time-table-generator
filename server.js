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
  credits: { type: Number, default: 3 }, // Course credits
  semesterHalf: { type: String, default: '0' } // '0' = both, '1' = first half, '2' = second half
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
  semesterHalf: String, // 'First_Half' or 'Second_Half'
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
        credits: parseInt(data.credits) || 3,
        // CRITICAL: Keep semesterHalf as STRING, not number
        semesterHalf: data.semesterHalf ? String(data.semesterHalf).trim() : '0'
      };
      results.push(cleanData);
    })
    .on('end', async () => {
      await Course.deleteMany({});
      await Course.insertMany(results);
      fs.unlinkSync(req.file.path);
      
      // Log distribution for verification
      const semHalf0 = results.filter(c => c.semesterHalf === '0').length;
      const semHalf1 = results.filter(c => c.semesterHalf === '1').length;
      const semHalf2 = results.filter(c => c.semesterHalf === '2').length;
      
      console.log('\n=== Uploaded Courses Distribution ===');
      console.log(`Total courses: ${results.length}`);
      console.log(`semesterHalf='0' (Both halves): ${semHalf0}`);
      console.log(`semesterHalf='1' (First half only): ${semHalf1}`);
      console.log(`semesterHalf='2' (Second half only): ${semHalf2}`);
      
      res.json({ 
        message: 'Courses uploaded successfully', 
        count: results.length,
        bothHalves: semHalf0,
        firstHalfOnly: semHalf1,
        secondHalfOnly: semHalf2
      });
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
    const timetable = await Timetable.find().sort({ branch: 1, year: 1, semesterHalf: 1, day: 1 });
    
    const groupedByBranchYear = {};
    
    timetable.forEach(entry => {
      if (!entry.branch || !entry.year) {
        return;
      }
      
      const key = `${entry.branch}-Year${entry.year}-${entry.semesterHalf}`;
      
      if (!groupedByBranchYear[key]) {
        groupedByBranchYear[key] = {
          branch: entry.branch,
          year: entry.year,
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
  const timetable = await Timetable.find().sort({ branch: 1, year: 1, semesterHalf: 1, day: 1 });
  
  let csvContent = 'Branch,Year,Semester Half,Day,Time Slot,Course,Faculty,Room,Type\n';
  timetable.forEach(entry => {
    csvContent += `${entry.branch},${entry.year},${entry.semesterHalf},${entry.day},${entry.timeSlot},${entry.course},${entry.faculty},${entry.room},${entry.type}\n`;
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


function generateTimetableWithSemesterSplit(courses, faculty, rooms) {
  const allTimetables = [];
  
  console.log('\n=== Course Distribution Analysis ===');
  console.log(`Total Courses: ${courses.length}`);
  
  // IMPORTANT: Separate courses by semester half setting using STRING comparison
  // semesterHalf is stored as STRING in database: '0', '1', or '2'
  const firstHalfOnlyCourses = courses.filter(c => String(c.semesterHalf) === '1');
  const secondHalfOnlyCourses = courses.filter(c => String(c.semesterHalf) === '2');
  const bothHalvesCourses = courses.filter(c => String(c.semesterHalf) === '0');
  
  console.log(`\nSemester Half Distribution:`);
  console.log(`  First Half Only (semesterHalf='1'): ${firstHalfOnlyCourses.length}`);
  console.log(`  Second Half Only (semesterHalf='2'): ${secondHalfOnlyCourses.length}`);
  console.log(`  Both Halves (semesterHalf='0'): ${bothHalvesCourses.length}`);
  
  // Debug: Show sample courses from each category
  if (firstHalfOnlyCourses.length > 0) {
    console.log(`\n  Sample First Half Only courses:`);
    firstHalfOnlyCourses.slice(0, 3).forEach(c => {
      console.log(`    ${c.code} - ${c.name} (semesterHalf='${c.semesterHalf}')`);
    });
  }
  
  if (secondHalfOnlyCourses.length > 0) {
    console.log(`\n  Sample Second Half Only courses:`);
    secondHalfOnlyCourses.slice(0, 3).forEach(c => {
      console.log(`    ${c.code} - ${c.name} (semesterHalf='${c.semesterHalf}')`);
    });
  }
  
  if (bothHalvesCourses.length > 0) {
    console.log(`\n  Sample Both Halves courses:`);
    bothHalvesCourses.slice(0, 3).forEach(c => {
      console.log(`    ${c.code} - ${c.name} (semesterHalf='${c.semesterHalf}')`);
    });
  }
  
  // Generate First Half timetable
  // Include: bothHalves courses + firstHalfOnly courses
  const firstHalfCourses = [
    ...bothHalvesCourses,
    ...firstHalfOnlyCourses
  ];
  
  console.log(`\n=== First Half Composition ===`);
  console.log(`Total Courses: ${firstHalfCourses.length}`);
  console.log(`  Both Halves: ${bothHalvesCourses.length}`);
  console.log(`  First Half Only: ${firstHalfOnlyCourses.length}`);
  
  const firstHalfTimetable = generateTimetableForHalf(firstHalfCourses, faculty, rooms, 'First_Half');
  allTimetables.push(...firstHalfTimetable);
  
  // Generate Second Half timetable
  // Include: bothHalves courses + secondHalfOnly courses
  const secondHalfCourses = [
    ...bothHalvesCourses,
    ...secondHalfOnlyCourses
  ];
  
  console.log(`\n=== Second Half Composition ===`);
  console.log(`Total Courses: ${secondHalfCourses.length}`);
  console.log(`  Both Halves: ${bothHalvesCourses.length}`);
  console.log(`  Second Half Only: ${secondHalfOnlyCourses.length}`);
  
  const secondHalfTimetable = generateTimetableForHalf(secondHalfCourses, faculty, rooms, 'Second_Half');
  allTimetables.push(...secondHalfTimetable);
  
  // Print detailed statistics
  console.log(`\n=== Final Statistics ===`);
  console.log(`Total entries: ${allTimetables.length}`);
  console.log(`First Half: ${firstHalfTimetable.length} entries`);
  console.log(`Second Half: ${secondHalfTimetable.length} entries`);
  
  // Count unique courses in each half
  const firstHalfUniqueCourses = new Set(
    firstHalfTimetable.map(t => t.course.split(' - ')[0].split(' (')[0])
  );
  const secondHalfUniqueCourses = new Set(
    secondHalfTimetable.map(t => t.course.split(' - ')[0].split(' (')[0])
  );
  
  console.log(`\nUnique Courses:`);
  console.log(`  First Half: ${firstHalfUniqueCourses.size} courses`);
  console.log(`  Second Half: ${secondHalfUniqueCourses.size} courses`);
  
  // Count courses appearing in both halves
  const inBothHalves = [...firstHalfUniqueCourses].filter(c => secondHalfUniqueCourses.has(c));
  console.log(`  Appearing in Both Halves: ${inBothHalves.length} courses`);
  
  return allTimetables;
}

function generateTimetableForHalf(courses, faculty, rooms, semesterHalf) {
  const timetable = [];
  const facultySchedule = {};
  const roomSchedule = {};
  const branchYearSchedule = {};
  const courseSchedule = {};

  const coursesByBranchYear = {};
  courses.forEach(course => {
    if (!course.branch || !course.year) {
      return;
    }
    
    const key = `${course.branch}-${course.year}`;
    if (!coursesByBranchYear[key]) {
      coursesByBranchYear[key] = [];
    }
    coursesByBranchYear[key].push(course);
  });

  console.log(`\n=== Generating ${semesterHalf} Timetable ===`);
  console.log('Found combinations:', Object.keys(coursesByBranchYear));
  
  const sortedKeys = Object.keys(coursesByBranchYear).sort();
  
  sortedKeys.forEach(branchYearKey => {
    const [branch, year] = branchYearKey.split('-');
    const branchCourses = coursesByBranchYear[branchYearKey];
    
    console.log(`\nProcessing ${branch} Year ${year}: ${branchCourses.length} courses`);

    branchYearSchedule[branchYearKey] = {};
    days.forEach(day => {
      branchYearSchedule[branchYearKey][day] = {};
    });

    const labCourses = branchCourses.filter(c => (c.type || '').toLowerCase().includes('lab'));
    const regularCourses = branchCourses.filter(c => !(c.type || '').toLowerCase().includes('lab'));

    const lecture90Combinations = findSlotsForDuration(90);
    const tutorial60Combinations = findSlotsForDuration(60);
    const lab120Combinations = findSlotsForDuration(120);

    regularCourses.forEach(course => {
      const courseKey = `${branchYearKey}-${course.code}-${semesterHalf}`;
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
                branchYearSchedule[branchYearKey][day][slot]) {
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
                semesterHalf: semesterHalf
              });

              facultySchedule[`${course.faculty}-${day}-${slot}-${semesterHalf}`] = true;
              roomSchedule[`${selectedRoom.number}-${day}-${slot}-${semesterHalf}`] = true;
              branchYearSchedule[branchYearKey][day][slot] = true;
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

    labCourses.forEach(course => {
      let assigned = false;
      let attempts = 0;
      const maxAttempts = days.length * lab120Combinations.length * 3;

      while (!assigned && attempts < maxAttempts) {
        const day = days[Math.floor(Math.random() * days.length)];
        const combination = lab120Combinations[Math.floor(Math.random() * lab120Combinations.length)];
        
        if (!combination) {
          attempts++;
          continue;
        }

        const slotsToUse = combination.slots;
        let selectedRoom;
        const labRooms = rooms.filter(r => (r.type || '').toLowerCase().includes('lab'));
        selectedRoom = labRooms.length > 0 ? 
          labRooms[Math.floor(Math.random() * labRooms.length)] : rooms[0];

        let hasConflict = false;
        for (const slot of slotsToUse) {
          const facultyKey = `${course.faculty}-${day}-${slot}-${semesterHalf}`;
          const roomKey = `${selectedRoom.number}-${day}-${slot}-${semesterHalf}`;
          
          if (facultySchedule[facultyKey] || roomSchedule[roomKey] || 
              branchYearSchedule[branchYearKey][day][slot]) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
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
              semesterHalf: semesterHalf
            });

            facultySchedule[`${course.faculty}-${day}-${slot}-${semesterHalf}`] = true;
            roomSchedule[`${selectedRoom.number}-${day}-${slot}-${semesterHalf}`] = true;
            branchYearSchedule[branchYearKey][day][slot] = true;
          });

          assigned = true;
          console.log(`  ✓ ${course.code} Lab - ${day} ${slotsToUse[0]}`);
        }

        attempts++;
      }

      if (!assigned) {
        console.log(`  ✗ Could not assign ${course.code} Lab`);
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