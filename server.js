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
  type: String
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
  generatedAt: { type: Date, default: Date.now }
});

const Course = mongoose.model('Course', courseSchema);
const Faculty = mongoose.model('Faculty', facultySchema);
const Room = mongoose.model('Room', roomSchema);
const Timetable = mongoose.model('Timetable', timetableSchema);

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
  const timetable = await Timetable.find().sort({ day: 1 });
  res.render('timetable', { timetable, days, timeSlots });
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

  // Sort courses by type priority (Labs first as they take more slots)
  const sortedCourses = [...courses].sort((a, b) => {
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
    const maxAttempts = days.length * timeSlots.length * 3;

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

      // Check conflicts for all slots needed
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
            type: course.type || 'Lecture'
          });

          const facultyKey = `${course.faculty}-${day}-${slot}`;
          const roomKey = `${selectedRoom.number}-${day}-${slot}`;
          
          facultySchedule[facultyKey] = true;
          roomSchedule[roomKey] = true;
        });

        // Increment day load counter
        dayLoadCount[day] += slotsNeeded;
        assigned = true;
      }

      attempts++;
    }

    if (!assigned) {
      console.log(`Warning: Could not assign ${course.name} to timetable`);
    }
  });

  // Log distribution statistics
  console.log('\nTimetable Distribution:');
  days.forEach(day => {
    console.log(`${day}: ${dayLoadCount[day]} classes`);
  });

  return timetable;
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});