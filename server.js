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
  year: Number
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
  students: mongoose.Schema.Types.Mixed, // Can be Number or String ("All")
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

// Time Slots
const timeSlots = [
  '09:00 - 10:00',
  '10:00 - 10:30',
  '10:30 - 10:45',
  '10:45 - 11:00',
  '11:00 - 12:00',
  '12:00 - 12:15',
  '12:15 - 12:30',
  '12:30 - 13:15',
  '13:15 - 14:00',
  '14:00 - 14:30',
  '14:30 - 15:30',
  '15:30 - 15:40',
  '15:40 - 16:00',
  '16:00 - 16:30',
  '16:30 - 17:10',
  '17:10 - 17:30',
  '17:30 - 18:30',
  '18:30 -'
];

const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.post('/upload/courses', upload.single('file'), async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
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

    const timetable = generateTimetable(courses, faculty, rooms);
    
    await Timetable.deleteMany({});
    await Timetable.insertMany(timetable);

    res.json({ message: 'Timetable generated successfully', entries: timetable.length });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get('/view', async (req, res) => {
  try {
    const timetable = await Timetable.find().sort({ branch: 1, year: 1, day: 1 });
    
    // Group by branch and year
    const groupedByBranchYear = {};
    
    timetable.forEach(entry => {
      const key = `${entry.branch}-Year${entry.year}`;
      if (!groupedByBranchYear[key]) {
        groupedByBranchYear[key] = {
          branch: entry.branch,
          year: entry.year,
          entries: []
        };
      }
      groupedByBranchYear[key].entries.push(entry);
    });

    console.log('Grouped timetables:', Object.keys(groupedByBranchYear));
    
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

app.get('/download', async (req, res) => {
  const timetable = await Timetable.find().sort({ day: 1 });
  
  let csvContent = 'Day,Time Slot,Course,Faculty,Room,Type\n';
  timetable.forEach(entry => {
    csvContent += `${entry.day},${entry.timeSlot},${entry.course},${entry.faculty},${entry.room},${entry.type}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=timetable.csv');
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
      // Use existing Room model
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
    
    // Group by branch only
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

    console.log('\nGrouped Schedule:');
    Object.keys(groupedByBranch).forEach(branch => {
      console.log(`  ${branch}: ${groupedByBranch[branch].exams.length} exams`);
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

function generateTimetable(courses, faculty, rooms) {
  const timetable = [];
  const facultySchedule = {};
  const roomSchedule = {};
  const dayLoadCount = {};
  const slotUsageCount = {};

  // Initialize day load counters
  days.forEach(day => {
    dayLoadCount[day] = 0;
  });

  // Group courses by branch and year
  const coursesByBranchYear = {};
  courses.forEach(course => {
    const key = `${course.branch}-${course.year}`;
    if (!coursesByBranchYear[key]) {
      coursesByBranchYear[key] = [];
    }
    coursesByBranchYear[key].push(course);
  });

  console.log('\n=== Generating Timetables for All Branch-Year Combinations ===');
  
  // Sort keys to ensure consistent ordering
  const sortedKeys = Object.keys(coursesByBranchYear).sort();
  
  sortedKeys.forEach(branchYearKey => {
    const [branch, year] = branchYearKey.split('-');
    const branchCourses = coursesByBranchYear[branchYearKey];
    
    console.log(`\nProcessing ${branch} Year ${year}: ${branchCourses.length} courses`);

    // Sort courses by type priority (Labs first as they take more slots)
    const sortedCourses = [...branchCourses].sort((a, b) => {
      const priorityMap = { 'lab': 3, 'tutorial': 2, 'lecture': 1 };
      const typeA = (a.type || 'lecture').toLowerCase();
      const typeB = (b.type || 'lecture').toLowerCase();
      const priorityA = priorityMap[typeA] || 1;
      const priorityB = priorityMap[typeB] || 1;
      return priorityB - priorityA;
    });

    sortedCourses.forEach(course => {
      let assigned = false;
      let attempts = 0;
      const maxAttempts = days.length * timeSlots.length * 5;

      // Calculate slots needed based on duration
      const slotsNeeded = parseInt(course.duration) || 1;

      while (!assigned && attempts < maxAttempts) {
        // Select day with minimum load for even distribution
        const sortedDays = [...days].sort((a, b) => dayLoadCount[a] - dayLoadCount[b]);
        const dayIndex = attempts < days.length ? attempts % days.length : Math.floor(Math.random() * days.length);
        const day = sortedDays[dayIndex];

        // Try to find consecutive slots for labs/longer classes
        const slotIndex = Math.floor(Math.random() * (timeSlots.length - slotsNeeded + 1));
        
        // Check if we can allocate consecutive slots
        let canAllocate = true;
        const slotsToUse = [];
        
        for (let i = 0; i < slotsNeeded; i++) {
          const currentSlotIndex = slotIndex + i;
          if (currentSlotIndex >= timeSlots.length) {
            canAllocate = false;
            break;
          }
          slotsToUse.push(timeSlots[currentSlotIndex]);
        }

        if (!canAllocate) {
          attempts++;
          continue;
        }

        // Select appropriate room based on course type
        let selectedRoom;
        const courseType = (course.type || '').toLowerCase();
        
        if (courseType.includes('lab')) {
          const labRooms = rooms.filter(r => (r.type || '').toLowerCase().includes('lab'));
          selectedRoom = labRooms.length > 0 ? labRooms[Math.floor(Math.random() * labRooms.length)] : rooms[0];
        } else {
          const classrooms = rooms.filter(r => (r.type || '').toLowerCase().includes('class'));
          selectedRoom = classrooms.length > 0 ? classrooms[Math.floor(Math.random() * classrooms.length)] : rooms[0];
        }

        // Check conflicts for all slots needed - GLOBAL check (no overlaps across all branches/years)
        let hasConflict = false;
        for (const slot of slotsToUse) {
          const facultyKey = `${course.faculty}-${day}-${slot}`;
          const roomKey = `${selectedRoom.number}-${day}-${slot}`;
          
          if (facultySchedule[facultyKey] || roomSchedule[roomKey]) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          // Allocate all required slots
          slotsToUse.forEach((slot, idx) => {
            const slotKey = `${day}-${slot}`;
            slotUsageCount[slotKey] = (slotUsageCount[slotKey] || 0) + 1;

            timetable.push({
              day,
              timeSlot: slot,
              course: course.name + (slotsNeeded > 1 ? ` (${idx + 1}/${slotsNeeded})` : ''),
              faculty: course.faculty,
              room: selectedRoom.number,
              type: course.type || 'Lecture',
              branch: course.branch,
              year: course.year
            });

            const facultyKey = `${course.faculty}-${day}-${slot}`;
            const roomKey = `${selectedRoom.number}-${day}-${slot}`;
            
            facultySchedule[facultyKey] = true;
            roomSchedule[roomKey] = true;
          });

          // Increment day load counter
          dayLoadCount[day] += slotsNeeded;
          assigned = true;
          console.log(`  ✓ ${course.code} assigned to ${day} ${slotsToUse[0]}`);
        }

        attempts++;
      }

      if (!assigned) {
        console.log(`  ✗ Warning: Could not assign ${course.name} (${course.code})`);
      }
    });
  });

  // Log distribution statistics
  console.log('\n=== Timetable Distribution ===');
  days.forEach(day => {
    console.log(`${day}: ${dayLoadCount[day]} total classes`);
  });

  console.log('\n=== Branch-Year Distribution ===');
  sortedKeys.forEach(key => {
    const count = timetable.filter(t => `${t.branch}-${t.year}` === key).length;
    console.log(`${key}: ${count} classes`);
  });

  console.log(`\nTotal classes scheduled: ${timetable.length}`);

  return timetable;
}

function generateExamSchedule(examCourses, invigilators, rooms) {
  const examSchedule = [];
  const invigilatorSchedule = {};
  const roomSchedule = {};
  const branchDateUsage = {}; // Track dates used by each branch (1 exam per day per branch)
  
  // Exam dates and slots
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

  // Filter out lab courses
  const theoryCourses = examCourses.filter(course => {
    const type = (course.type || '').toLowerCase();
    return !type.includes('lab') && !type.includes('practical');
  });

  // Group courses by branch
  const coursesByBranch = {};
  theoryCourses.forEach(course => {
    const branch = course.branch || 'Unknown';
    if (!coursesByBranch[branch]) {
      coursesByBranch[branch] = [];
    }
    coursesByBranch[branch].push(course);
  });

  console.log('\n=== Scheduling Exams Branch-wise ===');
  console.log('Rule: 1 exam per day per branch');
  console.log('Rule: 1 invigilator per room');
  console.log('Rule: Multiple branches can have exams on same day\n');
  
  // Process each branch separately
  Object.keys(coursesByBranch).sort().forEach(branch => {
    const courses = coursesByBranch[branch];
    
    console.log(`Processing ${branch}: ${courses.length} courses`);

    // Sort courses by student count (larger first for better room allocation)
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

      // Parse student count
      let studentsCount = 30;
      if (course.students && course.students.toLowerCase() !== 'all') {
        studentsCount = parseInt(course.students) || 30;
      }
      
      // Calculate rooms needed (reduce: 40 students per room instead of 30)
      const roomsNeeded = Math.ceil(studentsCount / 40);
      const invigilatorsNeeded = roomsNeeded; // 1 invigilator per room

      while (!assigned && attempts < maxAttempts) {
        const currentDateIndex = (dateIndex + Math.floor(attempts / examSlots.length)) % examDates.length;
        const slotIndex = attempts % examSlots.length;
        
        const examDate = examDates[currentDateIndex];
        const examSlot = examSlots[slotIndex];
        
        const scheduleKey = `${examDate.date}-${examSlot.slot}`;
        const branchDateKey = `${branch}-${examDate.date}`;

        // Check if this branch already has an exam on this date (prevent multiple exams per day for same branch)
        if (branchDateUsage[branchDateKey]) {
          attempts++;
          continue;
        }

        // Find available rooms for this slot
        const availableRooms = [];
        for (let room of rooms) {
          const roomKey = `${room.number}-${scheduleKey}`;
          if (!roomSchedule[roomKey]) {
            availableRooms.push(room);
            if (availableRooms.length >= roomsNeeded) break;
          }
        }

        // Find available invigilators (1 per room)
        const availableInvigilators = [];
        for (let inv of invigilators) {
          const invKey = `${inv.name}-${scheduleKey}`;
          if (!invigilatorSchedule[invKey]) {
            availableInvigilators.push(inv);
            if (availableInvigilators.length >= invigilatorsNeeded) break;
          }
        }

        // Check if we have enough resources
        if (availableRooms.length >= roomsNeeded && 
            availableInvigilators.length >= invigilatorsNeeded) {
          
          // Allocate rooms
          const assignedRooms = availableRooms.slice(0, roomsNeeded);
          assignedRooms.forEach(room => {
            const roomKey = `${room.number}-${scheduleKey}`;
            roomSchedule[roomKey] = true;
          });

          // Allocate invigilators (1 per room)
          const assignedInvigilators = availableInvigilators.slice(0, invigilatorsNeeded);
          assignedInvigilators.forEach(inv => {
            const invKey = `${inv.name}-${scheduleKey}`;
            invigilatorSchedule[invKey] = true;
          });

          // Mark this date as used for this branch
          branchDateUsage[branchDateKey] = true;

          // Create room-invigilator pairs (1 invigilator per room)
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
          dateIndex++; // Move to next date for next course
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
  console.log(`Labs excluded from exam schedule`);
  
  // Print branch-wise distribution
  const branchWiseCount = {};
  examSchedule.forEach(exam => {
    branchWiseCount[exam.branch] = (branchWiseCount[exam.branch] || 0) + 1;
  });
  
  console.log('\nBranch-wise Distribution:');
  Object.keys(branchWiseCount).sort().forEach(branch => {
    console.log(`  ${branch}: ${branchWiseCount[branch]} exams`);
  });
  
  return examSchedule;
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});