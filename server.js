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
  //'10:30 - 10:45', BREAK
  '10:45 - 11:00',
  '11:00 - 12:00',
  '12:00 - 12:15',
  '12:15 - 12:30',
  '12:30 - 13:15',
  // BREAK: 13:15 - 14:00 is removed
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

// Helper function to check if a time block crosses lunch break
function crossesLunchBreak(slots) {
  // Check if any slot is before lunch (12:30-13:15) and any is after lunch (14:00+)
  const hasBeforeLunch = slots.some(slot => {
    const [start] = slot.split(' - ');
    const [hour, min] = start.split(':').map(Number);
    const timeInMin = hour * 60 + min;
    return timeInMin <= 13 * 60 + 15; // Before or at 13:15
  });
  
  const hasAfterLunch = slots.some(slot => {
    const [start] = slot.split(' - ');
    const [hour, min] = start.split(':').map(Number);
    const timeInMin = hour * 60 + min;
    return timeInMin >= 14 * 60; // At or after 14:00
  });
  
  return hasBeforeLunch && hasAfterLunch;
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
    // Try different starting positions within this block
    for (let startIdx = 0; startIdx < block.slots.length; startIdx++) {
      let totalMinutes = 0;
      const selectedSlots = [];
      
      for (let i = startIdx; i < block.slots.length; i++) {
        const slot = block.slots[i];
        const duration = getSlotDuration(slot);
        selectedSlots.push(slot);
        totalMinutes += duration;
        
        // Check if we've reached target duration (with ±5 min tolerance)
        if (Math.abs(totalMinutes - targetMinutes) <= 5) {
          validCombinations.push({
            slots: [...selectedSlots],
            totalMinutes: totalMinutes,
            block: block.name
          });
          break;
        }
        
        // If we've exceeded, this combination won't work
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
        year: parseInt(data.year) || 1
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
    
    const groupedByBranchYear = {};
    
    timetable.forEach(entry => {
      if (!entry.branch || !entry.year) {
        console.log('Skipping invalid entry:', entry);
        return;
      }
      
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
    console.log('Entry counts:', Object.keys(groupedByBranchYear).map(k => 
      `${k}: ${groupedByBranchYear[k].entries.length} classes`
    ));
    
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
  const timetable = await Timetable.find().sort({ branch: 1, year: 1, day: 1 });
  
  let csvContent = 'Branch,Year,Day,Time Slot,Course,Faculty,Room,Type\n';
  timetable.forEach(entry => {
    csvContent += `${entry.branch},${entry.year},${entry.day},${entry.timeSlot},${entry.course},${entry.faculty},${entry.room},${entry.type}\n`;
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
  const branchYearSchedule = {};
  const courseSchedule = {}; // Track which days each course is scheduled

  // Group courses by branch and year
  const coursesByBranchYear = {};
  courses.forEach(course => {
    if (!course.branch || !course.year) {
      console.log('Skipping course without branch/year:', course);
      return;
    }
    
    const key = `${course.branch}-${course.year}`;
    if (!coursesByBranchYear[key]) {
      coursesByBranchYear[key] = [];
    }
    coursesByBranchYear[key].push(course);
  });

  console.log('\n=== Generating Timetables with Continuous Block Scheduling ===');
  console.log('Found combinations:', Object.keys(coursesByBranchYear));
  
  const sortedKeys = Object.keys(coursesByBranchYear).sort();
  
  sortedKeys.forEach(branchYearKey => {
    const [branch, year] = branchYearKey.split('-');
    const branchCourses = coursesByBranchYear[branchYearKey];
    
    console.log(`\nProcessing ${branch} Year ${year}: ${branchCourses.length} courses`);

    // Initialize branch-year schedule tracker
    branchYearSchedule[branchYearKey] = {};
    days.forEach(day => {
      branchYearSchedule[branchYearKey][day] = {};
    });

    // Separate labs and regular courses
    const labCourses = branchCourses.filter(c => (c.type || '').toLowerCase().includes('lab'));
    const regularCourses = branchCourses.filter(c => !(c.type || '').toLowerCase().includes('lab'));

    console.log(`  Regular courses: ${regularCourses.length}, Lab courses: ${labCourses.length}`);

    // Pre-calculate all possible slot combinations
    const lecture90Combinations = findSlotsForDuration(90);
    const tutorial60Combinations = findSlotsForDuration(60);
    const lab120Combinations = findSlotsForDuration(120);

    console.log(`  Found ${lecture90Combinations.length} valid 90-min combinations`);
    console.log(`  Found ${tutorial60Combinations.length} valid 60-min combinations`);
    console.log(`  Found ${lab120Combinations.length} valid 120-min combinations`);

    // Process regular courses (2 Lectures of 90 mins + 1 Tutorial of 60 mins)
    regularCourses.forEach(course => {
      const courseKey = `${branchYearKey}-${course.code}`;
      courseSchedule[courseKey] = []; // Track days used for this course
      
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
          // Select a random day that hasn't been used for this course
          const availableDays = days.filter(d => !courseSchedule[courseKey].includes(d));
          
          if (availableDays.length === 0) {
            console.log(`  ✗ No available days for ${course.code} ${session.type} ${session.sessionNum}`);
            break;
          }

          const day = availableDays[Math.floor(Math.random() * availableDays.length)];
          
          // Select a random slot combination
          const combination = session.combinations[Math.floor(Math.random() * session.combinations.length)];
          
          if (!combination) {
            attempts++;
            continue;
          }

          const slotsToUse = combination.slots;

          // Select appropriate room
          let selectedRoom;
          const classrooms = rooms.filter(r => (r.type || '').toLowerCase().includes('class'));
          selectedRoom = classrooms.length > 0 ? 
            classrooms[Math.floor(Math.random() * classrooms.length)] : rooms[0];

          // Check for conflicts
          let hasConflict = false;
          
          for (const slot of slotsToUse) {
            const facultyKey = `${course.faculty}-${day}-${slot}`;
            const roomKey = `${selectedRoom.number}-${day}-${slot}`;
            
            if (facultySchedule[facultyKey] || roomSchedule[roomKey] || 
                branchYearSchedule[branchYearKey][day][slot]) {
              hasConflict = true;
              break;
            }
          }

          if (!hasConflict) {
            // Assign the session
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
                year: parseInt(course.year)
              });

              // Mark resources as used
              facultySchedule[`${course.faculty}-${day}-${slot}`] = true;
              roomSchedule[`${selectedRoom.number}-${day}-${slot}`] = true;
              branchYearSchedule[branchYearKey][day][slot] = true;
            });

            // Mark this day as used for this course
            courseSchedule[courseKey].push(day);
            assigned = true;
            console.log(`  ✓ ${course.code} ${session.type} ${session.sessionNum || ''} - ${day} ${slotsToUse[0]} (${combination.totalMinutes} mins, block: ${combination.block})`);
          }

          attempts++;
        }

        if (!assigned) {
          console.log(`  ✗ Could not assign ${course.code} ${session.type} ${session.sessionNum || ''}`);
        }
      });
    });

    // Process lab courses (120 minutes)
    labCourses.forEach(course => {
      const courseKey = `${branchYearKey}-${course.code}`;
      let assigned = false;
      let attempts = 0;
      const maxAttempts = days.length * lab120Combinations.length * 3;

      while (!assigned && attempts < maxAttempts) {
        const day = days[Math.floor(Math.random() * days.length)];
        
        // Select a random 120-min combination
        const combination = lab120Combinations[Math.floor(Math.random() * lab120Combinations.length)];
        
        if (!combination) {
          attempts++;
          continue;
        }

        const slotsToUse = combination.slots;

        // Select lab room
        let selectedRoom;
        const labRooms = rooms.filter(r => (r.type || '').toLowerCase().includes('lab'));
        selectedRoom = labRooms.length > 0 ? 
          labRooms[Math.floor(Math.random() * labRooms.length)] : rooms[0];

        // Check conflicts
        let hasConflict = false;
        for (const slot of slotsToUse) {
          const facultyKey = `${course.faculty}-${day}-${slot}`;
          const roomKey = `${selectedRoom.number}-${day}-${slot}`;
          
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
              year: parseInt(course.year)
            });

            facultySchedule[`${course.faculty}-${day}-${slot}`] = true;
            roomSchedule[`${selectedRoom.number}-${day}-${slot}`] = true;
            branchYearSchedule[branchYearKey][day][slot] = true;
          });

          assigned = true;
          console.log(`  ✓ ${course.code} Lab - ${day} ${slotsToUse[0]} (${combination.totalMinutes} mins, block: ${combination.block})`);
        }

        attempts++;
      }

      if (!assigned) {
        console.log(`  ✗ Could not assign ${course.code} Lab`);
      }
    });
  });

  // Log distribution statistics
  console.log('\n=== Branch-Year Distribution ===');
  sortedKeys.forEach(key => {
    const [branch, year] = key.split('-');
    const count = timetable.filter(t => t.branch === branch && t.year === parseInt(year)).length;
    const uniqueCourses = new Set(timetable
      .filter(t => t.branch === branch && t.year === parseInt(year))
      .map(t => t.course.split(' - ')[0].split(' (')[0]));
    console.log(`${key}: ${count} slot entries, ${uniqueCourses.size} unique courses`);
  });

  console.log(`\nTotal slot entries scheduled: ${timetable.length}`);

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