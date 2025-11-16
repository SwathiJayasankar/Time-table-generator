// TIMETABLE GENERATOR MODULE
// Features: Duration-based slot allocation, Semester split, Conflict prevention, Elective slot reservation

// Available time slots (excluding break times)
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

// Elective slots: Reserved on Tuesday & Thursday from 17:10 to 18:30
const electiveSlots = {
  'TUESDAY': ['17:10 - 17:30', '17:30 - 18:30'],
  'THURSDAY': ['17:10 - 17:30', '17:30 - 18:30']
};

/**
 * Check if a slot is reserved for electives
 */
function isElectiveSlot(day, slot) {
  return electiveSlots[day] && electiveSlots[day].includes(slot);
}

/**
 * Calculate duration of a time slot in minutes
 * Example: "09:00 - 10:00" → 60 minutes
 */
function getSlotDuration(slot) {
  const [start, end] = slot.split(' - ');
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return endMinutes - startMinutes;
}

/**
 * Define continuous time blocks (no breaks in between)
 * Ensures multi-slot courses aren't interrupted by break times
 * Note: Elective slots (17:10-18:30) are included here but checked separately per day
 */
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

/**
 * Find consecutive slots that match target duration (±5 min tolerance)
 * Returns all possible combinations within continuous blocks
 * Example: 90 min → ["09:00-10:00", "10:00-10:30"] or ["11:00-12:00", "12:00-12:15", "12:15-12:30"]
 */
function findSlotsForDuration(targetMinutes) {
  const blocks = getContinuousTimeBlocks();
  const validCombinations = [];
  
  blocks.forEach(block => {
    // Try every starting position in block
    for (let startIdx = 0; startIdx < block.slots.length; startIdx++) {
      let totalMinutes = 0;
      const selectedSlots = [];
      
      // Add consecutive slots from this position
      for (let i = startIdx; i < block.slots.length; i++) {
        const slot = block.slots[i];
        const duration = getSlotDuration(slot);
        selectedSlots.push(slot);
        totalMinutes += duration;
        
        // Found valid combination (within tolerance)
        if (Math.abs(totalMinutes - targetMinutes) <= 5) {
          validCombinations.push({
            slots: [...selectedSlots],
            totalMinutes: totalMinutes,
            block: block.name
          });
          break;
        }
        
        // Exceeded target, try next start position
        if (totalMinutes > targetMinutes + 5) {
          break;
        }
      }
    }
  });
  
  return validCombinations;
}

/**
 * Main function: Generate timetable with semester split
 * 
 * Semester Logic:
 * - First Half: semesterHalf='1' OR (semesterHalf='0' AND credits>=3)
 * - Second Half: semesterHalf='2' OR semesterHalf='0'
 * 
 * This ensures high-credit courses run in first half, then get replaced by lighter courses
 * while low-credit courses continue throughout
 */
function generateTimetableWithSemesterSplit(courses, faculty, rooms) {
  const allTimetables = [];
  
  console.log('\n=== Analyzing Course Data ===');
  console.log(`Total courses loaded: ${courses.length}`);
  
  // Normalize course data (critical for CSV parsing)
  courses.forEach(c => {
    // Convert semesterHalf to string: '0' (full), '1' (first), '2' (second)
    if (c.semesterHalf !== undefined && c.semesterHalf !== null) {
      c.semesterHalf = String(c.semesterHalf).trim();
    } else {
      c.semesterHalf = '0';
    }
    
    // Convert credits to number
    if (typeof c.credits === 'string') {
      c.credits = parseFloat(c.credits) || 3;
    } else if (typeof c.credits !== 'number') {
      c.credits = 3;
    }
    
    // Trim all text fields
    c.code = (c.code || '').trim();
    c.name = (c.name || '').trim();
    c.faculty = (c.faculty || '').trim();
    c.type = (c.type || 'Lecture').trim();
    c.branch = (c.branch || '').trim();
    c.year = parseInt(c.year) || 1;
    c.section = c.section ? String(c.section).trim().toUpperCase() : '';
  });
  
  // Debug logging
  const sampleCourse = courses[0];
  if (sampleCourse) {
    console.log('Sample normalized course:', {
      code: sampleCourse.code,
      semesterHalf: `"${sampleCourse.semesterHalf}"`,
      credits: sampleCourse.credits,
      type: sampleCourse.type
    });
  }
  
  const semHalfCounts = {};
  courses.forEach(c => {
    const key = c.semesterHalf;
    semHalfCounts[key] = (semHalfCounts[key] || 0) + 1;
  });
  console.log('Courses by semesterHalf:', semHalfCounts);
  
  // Filter courses by semester half
  // First Half: Explicit '1' OR full-semester high-credit (0 AND >=3 credits)
  const firstHalfCourses = courses.filter(c => {
    const semHalf = c.semesterHalf;
    const credits = c.credits;
    
    if (semHalf === '1') return true;
    if (semHalf === '0' && credits >= 3) return true;
    return false;
  });

  // Second Half: Explicit '2' OR full-semester courses '0'
  const secondHalfCourses = courses.filter(c => {
    const semHalf = c.semesterHalf;
    
    if (semHalf === '2') return true;  // New post-mid courses
    if (semHalf === '0') return true;  // Continuing courses
    return false;
  });
  
  console.log('\n=== Course Distribution ===');
  console.log(`First Half courses: ${firstHalfCourses.length}`);
  console.log(`Second Half courses: ${secondHalfCourses.length}`);
  
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

/**
 * Generate timetable for one semester half
 * 
 * Process:
 * 1. Group courses by branch-year-section
 * 2. Separate labs from regular courses
 * 3. Schedule regular courses: 2 lectures (90min) + 1 tutorial (60min) on different days
 * 4. Schedule labs: 120min blocks using progressive fallback strategies
 * 
 * Conflict Prevention: Uses hashtables to track faculty/room/student availability
 * Elective Slot Protection: Skips Tuesday/Thursday 17:10-18:30 slots
 */
function generateTimetableForHalf(courses, faculty, rooms, semesterHalf) {
  const timetable = [];
  
  // Conflict tracking: key format is "identifier-day-slot-semester"
  const facultySchedule = {};
  const roomSchedule = {};
  const branchYearSectionSchedule = {};
  const courseSchedule = {};  // Tracks which days each course uses

  // Group courses by branch-year-section (each group = one class of students)
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
      
      // Mark elective slots as occupied so courses won't be scheduled there
      if (electiveSlots[day]) {
        electiveSlots[day].forEach(slot => {
          branchYearSectionSchedule[branchYearSectionKey][day][slot] = 'ELECTIVE_RESERVED';
        });
      }
    });

    const labCourses = branchCourses.filter(c => (c.type || '').toLowerCase().includes('lab'));
    const regularCourses = branchCourses.filter(c => !(c.type || '').toLowerCase().includes('lab'));

    console.log(`  Lab courses: ${labCourses.length}, Regular courses: ${regularCourses.length}`);

    const lecture90Combinations = findSlotsForDuration(90);
    const tutorial60Combinations = findSlotsForDuration(60);
    const lab120Combinations = findSlotsForDuration(120);

    // Process regular courses
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
          
          // Check if any slot conflicts with elective slots FOR THIS SPECIFIC DAY
          const hasElectiveConflict = slotsToUse.some(slot => isElectiveSlot(day, slot));
          if (hasElectiveConflict) {
            attempts++;
            continue;
          }
          
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

    // Process lab courses
    console.log(`\n  === Starting Lab Allocation for ${displayKey} ===`);
    
    labCourses.forEach(course => {
      let assigned = false;
      let attempts = 0;
      const maxAttempts = days.length * 50;

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
            
            totalMinutes = 0;
            for (const slot of slotsToUse) {
              totalMinutes += getSlotDuration(slot);
            }
            slotSource = `${numSlots}-consecutive-slots`;
          }
        }
        
        // Strategy 3: Just take ANY 2 consecutive available slots (excluding elective slots for Tue/Thu)
        if (slotsToUse.length === 0 && attempts > maxAttempts * 0.5) {
          // Filter out elective slots only for Tuesday and Thursday
          const availableSlots = timeSlots.filter(slot => !isElectiveSlot(day, slot));
          
          if (availableSlots.length >= 2) {
            const startIdx = Math.floor(Math.random() * (availableSlots.length - 1));
            slotsToUse = [availableSlots[startIdx], availableSlots[startIdx + 1]];
            
            totalMinutes = 0;
            for (const slot of slotsToUse) {
              totalMinutes += getSlotDuration(slot);
            }
            slotSource = 'any-2-slots';
          }
        }
        
        if (slotsToUse.length === 0) {
          attempts++;
          continue;
        }
        
        // Double-check no elective slots FOR THIS SPECIFIC DAY
        const hasElectiveConflict = slotsToUse.some(slot => isElectiveSlot(day, slot));
        if (hasElectiveConflict) {
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
      }
    });
  });

  return timetable;
}

module.exports = {
  generateTimetableWithSemesterSplit,
  timeSlots,
  days,
  electiveSlots,
  isElectiveSlot
};