// EXAM SCHEDULE GENERATOR WITH DATE RANGE
// Features: Custom start/end dates, automatic Sunday exclusion, one exam per day per branch-year

/**
 * Generate exam dates excluding Sundays
 * @param {String} startDate - Format: 'YYYY-MM-DD'
 * @param {String} endDate - Format: 'YYYY-MM-DD'
 * @returns {Array} Array of date objects with date, day, and formatted strings
 */
function generateExamDates(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }
  
  if (start > end) {
    throw new Error('Start date must be before or equal to end date');
  }
  
  const current = new Date(start);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    
    // Skip Sundays (0 = Sunday)
    if (dayOfWeek !== 0) {
      const day = String(current.getDate()).padStart(2, '0');
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const year = current.getFullYear();
      
      dates.push({
        date: `${year}-${month}-${day}`,
        displayDate: `${day}-${months[current.getMonth()]}-${year}`,
        day: days[dayOfWeek],
        dayOfWeek: dayOfWeek,
        dateObj: new Date(current)
      });
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Parse time slot string (e.g., "09:00 - 12:00")
 */
function parseTimeSlot(timeSlotStr) {
  if (!timeSlotStr || typeof timeSlotStr !== 'string') {
    return { slot: '09:00 - 12:00', label: 'Morning Session' };
  }
  
  const trimmed = timeSlotStr.trim();
  return {
    slot: trimmed,
    label: trimmed.includes('09:') || trimmed.includes('10:') || trimmed.includes('11:') ? 
          'Morning Session' : 'Afternoon Session'
  };
}

/**
 * Generate exam schedule with date range for all 4 years
 * @param {Array} courses - Array of course objects
 * @param {Array} invigilators - Array of invigilator names or objects with 'name' property
 * @param {Array} rooms - Array of room objects
 * @param {String} startDate - Format: 'YYYY-MM-DD'
 * @param {String} endDate - Format: 'YYYY-MM-DD'
 * @param {String} timeSlot1 - First time slot (e.g., "09:00 - 12:00")
 * @param {String} timeSlot2 - Second time slot (optional)
 * @returns {Array} Complete exam schedule
 */
function generateExamSchedule(courses, invigilators, rooms, startDate, endDate, timeSlot1, timeSlot2) {
  // Normalize invigilators to array of names
  const invigilatorNames = invigilators.map(inv => 
    typeof inv === 'string' ? inv : (inv.name || inv.Name || inv.NAME || 'Unknown')
  );
  
  console.log(`\nTotal invigilators available: ${invigilatorNames.length}`);
  console.log('\n=== EXAM SCHEDULE GENERATION ===');
  console.log(`Start Date: ${startDate}`);
  console.log(`End Date: ${endDate}`);
  
  // Generate available exam dates (excluding Sundays)
  const availableDates = generateExamDates(startDate, endDate);
  console.log(`\nAvailable exam dates (excluding Sundays): ${availableDates.length}`);
  
  if (availableDates.length === 0) {
    throw new Error('No valid exam dates available in the given range');
  }
  
  // Parse time slots
  const examTimes = [];
  if (timeSlot1) {
    examTimes.push(parseTimeSlot(timeSlot1));
  }
  if (timeSlot2) {
    examTimes.push(parseTimeSlot(timeSlot2));
  }
  
  if (examTimes.length === 0) {
    examTimes.push({ slot: '09:00 - 12:00', label: 'Morning Session' });
  }
  
  console.log(`Time Slots: ${examTimes.map(t => t.slot).join(', ')}`);
  
  // Filter only theory courses (exclude labs)
  const theoryCourses = courses.filter(c => {
    const type = (c.type || '').toLowerCase();
    return !type.includes('lab');
  });
  
  console.log(`\nTotal courses: ${courses.length}`);
  console.log(`Theory courses (eligible for exams): ${theoryCourses.length}`);
  
  // Group courses by Branch and Year
  const coursesByBranchYear = {};
  
  theoryCourses.forEach(course => {
    const branch = (course.branch || '').trim().toUpperCase();
    const year = parseInt(course.year) || 1;
    
    if (!branch) {
      console.warn(`Warning: Course ${course.code} has no branch specified`);
      return;
    }
    
    const key = `${branch}-Year${year}`;
    
    if (!coursesByBranchYear[key]) {
      coursesByBranchYear[key] = [];
    }
    
    coursesByBranchYear[key].push(course);
  });
  
  console.log('\n=== Courses by Branch and Year ===');
  Object.keys(coursesByBranchYear).sort().forEach(key => {
    console.log(`${key}: ${coursesByBranchYear[key].length} courses`);
  });
  
  // Check if we have enough dates
  const maxCoursesInGroup = Math.max(...Object.values(coursesByBranchYear).map(g => g.length));
  if (maxCoursesInGroup > availableDates.length) {
    console.warn(`\nWARNING: Not enough dates! Maximum courses in a group: ${maxCoursesInGroup}, Available dates: ${availableDates.length}`);
  }
  
  // Generate schedule
  const examSchedule = [];
  const invigilatorSchedule = {}; // Track invigilator availability
  const roomSchedule = {}; // Track room availability by date and time
  
  // Sort groups for consistent scheduling (Year 1 first, then Year 2, etc.)
  const sortedGroups = Object.keys(coursesByBranchYear).sort((a, b) => {
    const yearA = parseInt(a.split('Year')[1]);
    const yearB = parseInt(b.split('Year')[1]);
    if (yearA !== yearB) return yearA - yearB; // Sort by year first
    return a.localeCompare(b); // Then by branch name
  });
  
  sortedGroups.forEach(groupKey => {
    const groupCourses = coursesByBranchYear[groupKey];
    const [branch, yearStr] = groupKey.split('-');
    
    console.log(`\n=== Scheduling ${groupKey} ===`);
    console.log(`Courses to schedule: ${groupCourses.length}`);
    
    // Schedule one exam per day for this branch-year combination
    let dateIndex = 0;
    
    groupCourses.forEach((course, idx) => {
      if (dateIndex >= availableDates.length) {
        console.log(`⚠️  No more dates available for ${course.code}`);
        return;
      }
      
      const examDate = availableDates[dateIndex];
      const timeSlot = examTimes[0]; // Use first time slot (morning) by default
      
      // Get course faculty/invigilator
      const courseFaculty = (course.faculty || 'TBA').trim();
      
      // Calculate number of rooms needed
      const studentsPerRoom = 40;
      const totalStudents = parseInt(course.students) || 60; // Default 60 if not specified
      const roomsNeeded = Math.ceil(totalStudents / studentsPerRoom);
      
      console.log(`  Course: ${course.code} - Students: ${totalStudents}, Rooms needed: ${roomsNeeded}`);
      
      // Find available rooms for this date/time
      const availableRooms = rooms.filter(room => {
        const roomKey = `${room.number}-${examDate.date}-${timeSlot.slot}`;
        return !roomSchedule[roomKey];
      });
      
      // Allocate rooms
      const allocatedRooms = [];
      const assignedInvigilators = [];
      const roomInvigilatorPairs = [];
      
      for (let i = 0; i < roomsNeeded && i < availableRooms.length; i++) {
        const room = availableRooms[i];
        const roomKey = `${room.number}-${examDate.date}-${timeSlot.slot}`;
        
        // Find available invigilator (anyone not scheduled at this date/time)
        let assignedInvigilator = null;
        
        // Try course faculty first if they're in the invigilator list and available
        const facultyInList = invigilatorNames.includes(courseFaculty);
        const facultyKey = `${courseFaculty}-${examDate.date}-${timeSlot.slot}`;
        
        if (facultyInList && !invigilatorSchedule[facultyKey] && i === 0) {
          assignedInvigilator = courseFaculty;
          invigilatorSchedule[facultyKey] = true;
        } else {
          // Find any available invigilator
          for (const invName of invigilatorNames) {
            const invKey = `${invName}-${examDate.date}-${timeSlot.slot}`;
            if (!invigilatorSchedule[invKey]) {
              assignedInvigilator = invName;
              invigilatorSchedule[invKey] = true;
              break;
            }
          }
          
          // If no one available (shouldn't happen with enough invigilators), use fallback
          if (!assignedInvigilator) {
            assignedInvigilator = invigilatorNames[i % invigilatorNames.length] || 'TBA';
            console.warn(`⚠️  Warning: Had to double-book invigilator ${assignedInvigilator}`);
          }
        }
        
        allocatedRooms.push(room.number);
        assignedInvigilators.push(assignedInvigilator);
        roomInvigilatorPairs.push({
          room: room.number,
          invigilator: assignedInvigilator
        });
        
        // Mark room as occupied
        roomSchedule[roomKey] = true;
      }
      
      // Create exam entry
      const examEntry = {
        date: examDate.displayDate,
        day: examDate.day,
        timeSlot: timeSlot.slot,
        courseCode: course.code || 'N/A',
        courseName: course.name || 'Unnamed Course',
        credits: course.credits || 3,
        branch: branch,
        year: parseInt(course.year) || 1,
        students: totalStudents,
        rooms: allocatedRooms,
        invigilators: assignedInvigilators,
        roomInvigilatorPairs: roomInvigilatorPairs
      };
      
      examSchedule.push(examEntry);
      
      console.log(`  ✅ [${idx + 1}/${groupCourses.length}] ${course.code}: ${examDate.displayDate} (${examDate.day})`);
      console.log(`     Rooms: ${allocatedRooms.join(', ')}`);
      console.log(`     Invigilators: ${assignedInvigilators.join(', ')}`);
      
      // Move to next date (one exam per day per branch-year)
      dateIndex++;
    });
  });
  
  console.log(`\n=== Schedule Complete ===`);
  console.log(`Total exams scheduled: ${examSchedule.length}`);
  console.log(`Dates used: ${Math.max(...sortedGroups.map(g => coursesByBranchYear[g].length))} / ${availableDates.length}`);
  
  return examSchedule;
}

module.exports = {
  generateExamSchedule,
  generateExamDates
};