// TIMETABLE GENERATOR MODULE
// Features: Duration-based slot allocation, Semester split, Conflict prevention, Elective slot reservation
// NEW: Support for combined sections (A+B) in large rooms (240 seater)
// PRIORITY: Schedule ALL labs (120min) FIRST, then schedule lectures and tutorials

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
 * Define continuous time blocks
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
 */
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

/**
 * Find all possible 120-minute slot combinations for labs across all days
 */
function findAllLab120CombinationsAcrossDays() {
  const lab120Base = findSlotsForDuration(120);
  const allCombinations = [];
  
  days.forEach(day => {
    lab120Base.forEach(combo => {
      const hasElectiveConflict = combo.slots.some(slot => isElectiveSlot(day, slot));
      if (!hasElectiveConflict) {
        allCombinations.push({
          day: day,
          slots: combo.slots,
          totalMinutes: combo.totalMinutes,
          block: combo.block
        });
      }
    });
  });
  
  return allCombinations;
}

/**
 * Main function: Generate timetable with semester split
 */
function generateTimetableWithSemesterSplit(courses, faculty, rooms) {
  const allTimetables = [];
  
  console.log('\n=== Analyzing Course Data ===');
  console.log(`Total courses loaded: ${courses.length}`);
  
  // Normalize course data
  courses.forEach(c => {
    if (c.semesterHalf !== undefined && c.semesterHalf !== null) {
      c.semesterHalf = String(c.semesterHalf).trim();
    } else {
      c.semesterHalf = '0';
    }
    
    if (typeof c.credits === 'string') {
      c.credits = parseFloat(c.credits) || 3;
    } else if (typeof c.credits !== 'number') {
      c.credits = 3;
    }
    
    c.code = (c.code || '').trim();
    c.name = (c.name || '').trim();
    c.faculty = (c.faculty || '').trim();
    c.type = (c.type || 'Lecture').trim();
    c.branch = (c.branch || '').trim();
    c.year = parseInt(c.year) || 1;
    c.section = c.section ? String(c.section).trim().toUpperCase() : '';
    
    // NEW: Handle combinedSections field
    // Format: "A,B" or "A+B" or "" (empty means separate sections)
    if (c.combinedSections !== undefined && c.combinedSections !== null) {
      c.combinedSections = String(c.combinedSections).trim();
    } else {
      c.combinedSections = '';
    }
  });
  
  // Filter courses by semester half
  const firstHalfCourses = courses.filter(c => {
    const semHalf = c.semesterHalf;
    const credits = c.credits;
    
    if (semHalf === '1') return true;
    if (semHalf === '0' && credits >= 3) return true;
    return false;
  });

  const secondHalfCourses = courses.filter(c => {
    const semHalf = c.semesterHalf;
    
    if (semHalf === '2') return true;
    if (semHalf === '0') return true;
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
 * Group courses and identify combined section courses
 * Returns: {
 *   coursesByBranchYearSection: {...},
 *   combinedCourses: [...],
 *   combinedCoursesMap: {...}
 * }
 */
function groupAndIdentifyCombinedCourses(courses) {
  const coursesByBranchYearSection = {};
  const combinedCourses = [];
  const combinedCoursesMap = {}; // key: branch-year-code, value: course object
  
  courses.forEach(course => {
    if (!course.branch || !course.year) {
      return;
    }
    
    const section = course.section || '';
    
    // Check if this course has combined sections
    if (course.combinedSections && course.combinedSections.length > 0) {
      const combinedKey = `${course.branch}-${course.year}-${course.code}`;
      
      // Only add once per unique course (avoid duplicates from section A and B entries)
      if (!combinedCoursesMap[combinedKey]) {
        combinedCoursesMap[combinedKey] = course;
        combinedCourses.push(course);
        console.log(`  🔗 Found combined section course: ${course.code} - ${course.name}`);
        console.log(`     Sections: ${course.combinedSections}`);
      }
      // Don't add to section-specific groups
      return;
    }
    
    // Regular section-specific courses
    const key = section ? `${course.branch}-${course.year}-${section}` : `${course.branch}-${course.year}`;
    
    if (!coursesByBranchYearSection[key]) {
      coursesByBranchYearSection[key] = [];
    }
    coursesByBranchYearSection[key].push(course);
  });
  
  return {
    coursesByBranchYearSection,
    combinedCourses,
    combinedCoursesMap
  };
}

/**
 * Generate timetable for one semester half
 * 
 * PRIORITY ORDER:
 * 1. Schedule COMBINED SECTION courses first (A+B together in 240-seater)
 * 2. Schedule ALL labs (120 minutes each)
 * 3. Schedule regular lectures and tutorials
 */
function generateTimetableForHalf(courses, faculty, rooms, semesterHalf) {
  const timetable = [];
  
  // Conflict tracking
  const facultySchedule = {};
  const roomSchedule = {};
  const branchYearSectionSchedule = {};
  const courseSchedule = {};

  // Group courses and identify combined section courses
  const {
    coursesByBranchYearSection,
    combinedCourses,
    combinedCoursesMap
  } = groupAndIdentifyCombinedCourses(courses);

  console.log(`\n=== Generating ${semesterHalf} Timetable ===`);
  console.log(`Total combined section courses: ${combinedCourses.length}`);
  console.log('Section-specific combinations:', Object.keys(coursesByBranchYearSection));
  
  const sortedKeys = Object.keys(coursesByBranchYearSection).sort();
  
  // Initialize schedules for all sections
  sortedKeys.forEach(branchYearSectionKey => {
    branchYearSectionSchedule[branchYearSectionKey] = {};
    days.forEach(day => {
      branchYearSectionSchedule[branchYearSectionKey][day] = {};
      
      // Mark elective slots as occupied
      if (electiveSlots[day]) {
        electiveSlots[day].forEach(slot => {
          branchYearSectionSchedule[branchYearSectionKey][day][slot] = 'ELECTIVE_RESERVED';
        });
      }
    });
  });
  
  // Pre-compute slot combinations
  const allLab120Slots = findAllLab120CombinationsAcrossDays();
  const lecture90Combinations = findSlotsForDuration(90);
  const tutorial60Combinations = findSlotsForDuration(60);
  
  console.log(`\nAvailable slot combinations:`);
  console.log(`  - 120min lab slots: ${allLab120Slots.length}`);
  console.log(`  - 90min lecture combinations: ${lecture90Combinations.length}`);
  console.log(`  - 60min tutorial combinations: ${tutorial60Combinations.length}`);

  // ===================================================================
  // PHASE 0: SCHEDULE COMBINED SECTION COURSES (HIGHEST PRIORITY)
  // ===================================================================
  if (combinedCourses.length > 0) {
    console.log(`\n  ╔══════════════════════════════════════════════════════════╗`);
    console.log(`  ║ PHASE 0: COMBINED SECTIONS (A+B) - HIGHEST PRIORITY     ║`);
    console.log(`  ╚══════════════════════════════════════════════════════════╝`);
    
    combinedCourses.forEach((course, idx) => {
      console.log(`\n  [Combined ${idx + 1}/${combinedCourses.length}] ${course.code} - ${course.name}`);
      console.log(`     Sections: ${course.combinedSections}`);
      console.log(`     Faculty: ${course.faculty}`);
      
      // Parse which sections are combined (e.g., "A,B" or "A+B")
      const sectionsArray = course.combinedSections
        .replace(/\+/g, ',')
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(s => s.length > 0);
      
      // Find 240-seater room
      let largeRoom = rooms.find(r => {
        const capacity = parseInt(r.capacity) || 0;
        return capacity >= 200 && (r.type || '').toLowerCase().includes('class');
      });
      
      if (!largeRoom) {
        console.log(`     ⚠️  WARNING: No 240-seater room found, using largest available`);
        largeRoom = rooms.reduce((max, r) => {
          const capacity = parseInt(r.capacity) || 0;
          const maxCapacity = parseInt(max.capacity) || 0;
          return capacity > maxCapacity ? r : max;
        }, rooms[0]);
      }
      
      console.log(`     Room: ${largeRoom.number} (Capacity: ${largeRoom.capacity})`);
      
      // Schedule sessions: 2 lectures + 1 tutorial
      const sessionsNeeded = [
        { type: 'Lecture', duration: 90, sessionNum: 1, combinations: lecture90Combinations },
        { type: 'Lecture', duration: 90, sessionNum: 2, combinations: lecture90Combinations },
        { type: 'Tutorial', duration: 60, sessionNum: 1, combinations: tutorial60Combinations }
      ];
      
      const courseKey = `${course.branch}-${course.year}-${course.code}-combined-${semesterHalf}`;
      courseSchedule[courseKey] = [];
      
      sessionsNeeded.forEach(session => {
        let assigned = false;
        let attempts = 0;
        const maxAttempts = days.length * session.combinations.length * 5;
        
        while (!assigned && attempts < maxAttempts) {
          // Pick a day not already used for this course
          const availableDays = days.filter(d => !courseSchedule[courseKey].includes(d));
          if (availableDays.length === 0) break;
          
          const day = availableDays[Math.floor(Math.random() * availableDays.length)];
          const combination = session.combinations[Math.floor(Math.random() * session.combinations.length)];
          
          if (!combination) {
            attempts++;
            continue;
          }
          
          const slotsToUse = combination.slots;
          
          // Check elective conflicts
          const hasElectiveConflict = slotsToUse.some(slot => isElectiveSlot(day, slot));
          if (hasElectiveConflict) {
            attempts++;
            continue;
          }
          
          // Check conflicts for ALL sections involved
          let hasConflict = false;
          
          for (const slot of slotsToUse) {
            const facultyKey = `${course.faculty}-${day}-${slot}-${semesterHalf}`;
            const roomKey = `${largeRoom.number}-${day}-${slot}-${semesterHalf}`;
            
            if (facultySchedule[facultyKey] || roomSchedule[roomKey]) {
              hasConflict = true;
              break;
            }
            
            // Check if any of the combined sections have conflicts
            for (const section of sectionsArray) {
              const sectionKey = `${course.branch}-${course.year}-${section}`;
              if (branchYearSectionSchedule[sectionKey] && 
                  branchYearSectionSchedule[sectionKey][day] && 
                  branchYearSectionSchedule[sectionKey][day][slot]) {
                hasConflict = true;
                break;
              }
            }
            
            if (hasConflict) break;
          }
          
          if (!hasConflict) {
            // Book for ALL sections
            slotsToUse.forEach((slot, slotIdx) => {
              const sessionLabel = session.type === 'Tutorial' ? 
                'Tutorial' : `Lecture ${session.sessionNum}`;
              
              let courseName = `${course.name} - ${sessionLabel}`;
              if (slotsToUse.length > 1) {
                courseName += ` (${slotIdx + 1}/${slotsToUse.length})`;
              }
              
              // Create entries for each section
              sectionsArray.forEach(section => {
                timetable.push({
                  day,
                  timeSlot: slot,
                  course: courseName + ` [Combined: ${course.combinedSections}]`,
                  faculty: course.faculty,
                  room: largeRoom.number,
                  type: session.type,
                  branch: course.branch,
                  year: parseInt(course.year),
                  section: section,
                  semesterHalf: semesterHalf,
                  isCombined: true
                });
                
                // Mark section as occupied
                const sectionKey = `${course.branch}-${course.year}-${section}`;
                if (branchYearSectionSchedule[sectionKey]) {
                  branchYearSectionSchedule[sectionKey][day][slot] = true;
                }
              });
              
              // Mark faculty and room as occupied
              facultySchedule[`${course.faculty}-${day}-${slot}-${semesterHalf}`] = true;
              roomSchedule[`${largeRoom.number}-${day}-${slot}-${semesterHalf}`] = true;
            });
            
            courseSchedule[courseKey].push(day);
            assigned = true;
            console.log(`     ✅ ${session.type} ${session.sessionNum || ''}: ${day} ${slotsToUse[0]}`);
          }
          
          attempts++;
        }
        
        if (!assigned) {
          console.log(`     ❌ Failed: ${session.type} ${session.sessionNum || ''}`);
        }
      });
    });
  }

  // ===================================================================
  // PROCESS EACH SECTION INDIVIDUALLY
  // ===================================================================
  sortedKeys.forEach(branchYearSectionKey => {
    const parts = branchYearSectionKey.split('-');
    const branch = parts[0];
    const year = parts[1];
    const section = parts[2] || '';
    
    const branchCourses = coursesByBranchYearSection[branchYearSectionKey];
    
    const displayKey = section ? `${branch} Year ${year} Section ${section}` : `${branch} Year ${year}`;
    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║ Processing ${displayKey}: ${branchCourses.length} courses`);
    console.log(`╚════════════════════════════════════════════════════════════╝`);

    const labCourses = branchCourses.filter(c => (c.type || '').toLowerCase().includes('lab'));
    const regularCourses = branchCourses.filter(c => !(c.type || '').toLowerCase().includes('lab'));

    console.log(`\n  📊 Course breakdown:`);
    console.log(`     - Lab courses: ${labCourses.length}`);
    console.log(`     - Regular courses: ${regularCourses.length}`);

    // ===================================================================
    // PHASE 1: SCHEDULE LABS
    // ===================================================================
    console.log(`\n  ╔══════════════════════════════════════════════════════════╗`);
    console.log(`  ║ PHASE 1: SCHEDULING LABS (120 minutes each)             ║`);
    console.log(`  ╚══════════════════════════════════════════════════════════╝`);
    
    labCourses.forEach((course, labIndex) => {
      let assigned = false;
      let attempts = 0;
      const maxAttempts = allLab120Slots.length * 3;

      console.log(`\n  [Lab ${labIndex + 1}/${labCourses.length}] ${course.code} - ${course.name}`);

      while (!assigned && attempts < maxAttempts) {
        const slotCombo = allLab120Slots[Math.floor(Math.random() * allLab120Slots.length)];
        const day = slotCombo.day;
        const slotsToUse = slotCombo.slots;
        const totalMinutes = slotCombo.totalMinutes;

        let selectedRoom;
        const labRooms = rooms.filter(r => (r.type || '').toLowerCase().includes('lab'));
        if (labRooms.length > 0) {
          selectedRoom = labRooms[Math.floor(Math.random() * labRooms.length)];
        } else {
          selectedRoom = rooms[Math.floor(Math.random() * rooms.length)];
        }

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
              semesterHalf: semesterHalf,
              isCombined: false
            });

            facultySchedule[`${course.faculty}-${day}-${slot}-${semesterHalf}`] = true;
            roomSchedule[`${selectedRoom.number}-${day}-${slot}-${semesterHalf}`] = true;
            branchYearSectionSchedule[branchYearSectionKey][day][slot] = true;
          });

          assigned = true;
          console.log(`     ✅ SUCCESS: ${day} ${slotsToUse[0]} → ${slotsToUse[slotsToUse.length-1]}`);
          console.log(`        Duration: ${totalMinutes} minutes (${slotsToUse.length} slots)`);
          console.log(`        Room: ${selectedRoom.number}`);
        }

        attempts++;
      }

      if (!assigned) {
        console.log(`     ❌ FAILED: Could not find valid 120min slot after ${attempts} attempts`);
      }
    });

    // ===================================================================
    // PHASE 2: SCHEDULE LECTURES AND TUTORIALS
    // ===================================================================
    console.log(`\n  ╔══════════════════════════════════════════════════════════╗`);
    console.log(`  ║ PHASE 2: SCHEDULING LECTURES & TUTORIALS                ║`);
    console.log(`  ╚══════════════════════════════════════════════════════════╝`);

    regularCourses.forEach((course, courseIndex) => {
      console.log(`\n  [Course ${courseIndex + 1}/${regularCourses.length}] ${course.code} - ${course.name}`);
      
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
                semesterHalf: semesterHalf,
                isCombined: false
              });

              facultySchedule[`${course.faculty}-${day}-${slot}-${semesterHalf}`] = true;
              roomSchedule[`${selectedRoom.number}-${day}-${slot}-${semesterHalf}`] = true;
              branchYearSectionSchedule[branchYearSectionKey][day][slot] = true;
            });

            courseSchedule[courseKey].push(day);
            assigned = true;
            console.log(`     ✅ ${session.type} ${session.sessionNum || ''}: ${day} ${slotsToUse[0]}`);
          }

          attempts++;
        }

        if (!assigned) {
          console.log(`     ❌ Failed: ${session.type} ${session.sessionNum || ''}`);
        }
      });
    });
  });

  return timetable;
}

module.exports = {
  generateTimetableWithSemesterSplit,
  timeSlots,
  days,
  electiveSlots,
  isElectiveSlot,
  findAllLab120CombinationsAcrossDays
};