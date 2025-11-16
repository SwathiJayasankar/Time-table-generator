
/**
 
 * Rules:
 * - 1 exam per day per branch-year combination
 * - 30 students per room
 * - 1 invigilator per room
 * - Same date/time can be used by different branches
 * 
 * Algorithm:
 * 1. Group courses by branch-year
 * 3. For each course, find available date/slot without conflicts
 * 4. Allocate required rooms and invigilators
 * 5. Mark resources as occupied
 */

function generateExamSchedule(examCourses, invigilators, rooms) {
  const examSchedule = [];
  
  // Conflict tracking hashtables
  const invigilatorSchedule = {};  // Key: "name-date-slot"
  const roomSchedule = {};         // Key: "roomNumber-date-slot"
  const branchYearDateUsage = {};  // Key: "branch-year-date" (ensures 1 exam/day/branch)
  
  // Exam dates (Nov 20 - Dec 6, 2025, excluding Sundays)
  const examDates = [
    { date: '20-Nov-2025', day: 'Wednesday' },
    { date: '21-Nov-2025', day: 'Thursday' },
    { date: '22-Nov-2025', day: 'Friday' },
    { date: '23-Nov-2025', day: 'Saturday' },
    { date: '25-Nov-2025', day: 'Monday' },
    { date: '26-Nov-2025', day: 'Tuesday' },
    { date: '27-Nov-2025', day: 'Wednesday' },
    { date: '28-Nov-2025', day: 'Thursday' },
    { date: '29-Nov-2025', day: 'Friday' },
    { date: '30-Nov-2025', day: 'Saturday' },
    { date: '02-Dec-2025', day: 'Monday' },
    { date: '03-Dec-2025', day: 'Tuesday' },
    { date: '04-Dec-2025', day: 'Wednesday' },
    { date: '05-Dec-2025', day: 'Thursday' },
    { date: '06-Dec-2025', day: 'Friday' }
  ];
  
  // Two slots per day: Forenoon and Afternoon
  const examSlots = [
    { slot: 'FN: 09:00 AM - 12:00 PM', priority: 1 },
    { slot: 'AN: 02:00 PM - 05:00 PM', priority: 2 }
  ];

  // Group courses by branch and year
  const coursesByBranchYear = {};
  examCourses.forEach(course => {
    const branch = course.branch || 'Unknown';
    const year = parseInt(course.year) || 1;
    const key = `${branch}-Year${year}`;
    
    if (!coursesByBranchYear[key]) {
      coursesByBranchYear[key] = {
        branch: branch,
        year: year,
        courses: []
      };
    }
    coursesByBranchYear[key].courses.push(course);
  });

  console.log('\n=== Scheduling Exams for All Branches & Years ===');
  console.log(`Total branch-year combinations: ${Object.keys(coursesByBranchYear).length}`);
  
  // Sort keys for consistent ordering (CSE-Year1, CSE-Year2, etc.)
  const sortedKeys = Object.keys(coursesByBranchYear).sort((a, b) => {
    const [branchA, yearA] = a.split('-Year');
    const [branchB, yearB] = b.split('-Year');
    if (branchA !== branchB) return branchA.localeCompare(branchB);
    return parseInt(yearA) - parseInt(yearB);
  });
  
  // Process each branch-year group
  sortedKeys.forEach(key => {
    const data = coursesByBranchYear[key];
    const { branch, year, courses } = data;
    
    console.log(`\n=== ${branch} - Year ${year} ===`);
    console.log(`Total courses: ${courses.length}`);

    // Sort courses by credits (higher credits = higher priority)
    courses.sort((a, b) => {
      const creditsA = parseInt(a.credits) || 0;
      const creditsB = parseInt(b.credits) || 0;
      if (creditsB !== creditsA) return creditsB - creditsA;
      
      // Secondary sort: by student count
      const studentsA = parseInt(a.students) || 30;
      const studentsB = parseInt(b.students) || 30;
      return studentsB - studentsA;
    });

    let dateIndex = 0;  // Track which date to try next

    // Schedule each course
    courses.forEach(course => {
      let assigned = false;
      let attempts = 0;
      const maxAttempts = examDates.length * examSlots.length * 2;

      const studentsCount = parseInt(course.students) || 30;
      
      // Calculate resource requirements
      const roomsNeeded = Math.ceil(studentsCount / 30);
      const invigilatorsNeeded = roomsNeeded;

      // Try to find available slot
      while (!assigned && attempts < maxAttempts) {
        // Cycle through dates
        const currentDateIndex = (dateIndex + Math.floor(attempts / examSlots.length)) % examDates.length;
        const slotIndex = attempts % examSlots.length;
        
        const examDate = examDates[currentDateIndex];
        const examSlot = examSlots[slotIndex];
        
        const scheduleKey = `${examDate.date}-${examSlot.slot}`;
        const branchYearDateKey = `${branch}-${year}-${examDate.date}`;

        // Check if this branch-year already has an exam on this date
        if (branchYearDateUsage[branchYearDateKey]) {
          attempts++;
          continue;
        }

        // Find available rooms
        const availableRooms = [];
        for (let room of rooms) {
          const roomKey = `${room.number}-${scheduleKey}`;
          if (!roomSchedule[roomKey]) {
            availableRooms.push(room);
            if (availableRooms.length >= roomsNeeded) break;
          }
        }

        // Find available invigilators
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
          
          // Assign rooms
          const assignedRooms = availableRooms.slice(0, roomsNeeded);
          assignedRooms.forEach(room => {
            const roomKey = `${room.number}-${scheduleKey}`;
            roomSchedule[roomKey] = true;
          });

          // Assign invigilators
          const assignedInvigilators = availableInvigilators.slice(0, invigilatorsNeeded);
          assignedInvigilators.forEach(inv => {
            const invKey = `${inv.name}-${scheduleKey}`;
            invigilatorSchedule[invKey] = true;
          });

          // Mark date as used for this branch-year
          branchYearDateUsage[branchYearDateKey] = true;

          // Create room-invigilator pairs for display
          const roomInvigilatorPairs = [];
          assignedRooms.forEach((room, idx) => {
            const inv = assignedInvigilators[idx];
            roomInvigilatorPairs.push({
              room: room.number,
              invigilator: inv?.name || 'TBD'
            });
          });

          // Add to exam schedule
          examSchedule.push({
            date: examDate.date,
            day: examDate.day,
            timeSlot: examSlot.slot,
            courseCode: course.code,
            courseName: course.name,
            credits: parseInt(course.credits) || 0,
            branch: branch,
            year: year,
            students: studentsCount,
            invigilators: assignedInvigilators.map(inv => inv.name),
            rooms: assignedRooms.map(room => room.number),
            roomInvigilatorPairs: roomInvigilatorPairs
          });

          console.log(`  ✓ ${course.code} (${course.credits} cr) - ${examDate.date} ${examSlot.slot}`);
          assigned = true;
          dateIndex = (dateIndex + 1) % examDates.length;  // Move to next date
        }

        attempts++;
      }

      if (!assigned) {
        console.log(`  ✗ FAILED: ${course.code} - ${course.name} (Not enough resources)`);
      }
    });
  });

  // Print summary
  console.log(`\n=== Exam Scheduling Summary ===`);
  console.log(`Total exams scheduled: ${examSchedule.length}`);
  
  sortedKeys.forEach(key => {
    const data = coursesByBranchYear[key];
    const branchYearExams = examSchedule.filter(e => 
      e.branch === data.branch && e.year === data.year
    );
    console.log(`  ${data.branch} Year ${data.year}: ${branchYearExams.length} exams`);
  });
  
  return examSchedule;
}

module.exports = {
  generateExamSchedule
};