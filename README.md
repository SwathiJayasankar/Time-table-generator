🕒 Automated Timetable Generator
The Automated Timetable Generator is a comprehensive MERN stack application that automates the creation of conflict-free academic schedules. It generates both regular class timetables and examination schedules with intelligent resource allocation and constraint-based optimization — saving time, reducing human error, and ensuring efficient utilization of resources.

⚙️ Tech Stack
Backend: Node.js, Express.js
Database: MongoDB
File Upload: Multer
CSV Parsing: csv-parser
Frontend: HTML5, CSS3, EJS Templates
Language: JavaScript (ES6+)
✨ Features
📚 Class Timetable Module
✅ CSV upload for courses, faculty, and rooms
✅ Automated timetable generation with conflict resolution
✅ Duration-based scheduling:
Lectures: 2 sessions × 90 minutes (on different days)
Tutorials: 1 session × 60 minutes
Labs: 1 session × 120 minutes
✅ Semester split management (Pre-mid and Post-mid)
✅ Smart slot allocation with consecutive time blocks
✅ Different days enforcement for course sessions
✅ Elective slot protection (Tuesday & Thursday 17:10-18:30)
✅ Multi-branch support (CSE, DSAI, ECE)
✅ Section management for multiple classes
✅ Color-coded timetable view:
🔵 Blue - Lectures
🟢 Green - Tutorials
🔴 Red - Labs
🟡 Yellow - Electives
✅ Smart room allocation (Labs → Lab rooms, Lectures → Classrooms)
✅ Faculty-wise timetable view
✅ Export timetable to CSV
✅ Print-friendly view
✅ Modern, responsive UI with hierarchical navigation
📋 Exam Scheduler Module
✅ Automated exam schedule generation (Nov 20 - Dec 6, 2025)
✅ One exam per day per branch-year constraint
✅ Resource allocation (30 students per room, 1 invigilator per room)
✅ Dual time slots:
Forenoon: 09:00 AM - 12:00 PM
Afternoon: 02:00 PM - 05:00 PM
✅ Priority scheduling based on credits
✅ Cross-branch optimization
✅ Room-invigilator pairing
✅ Export exam schedule to CSV
📥 Inputs
The system accepts data through CSV files:

Class Timetable Inputs
Input Type	Required Columns	Description
Courses	code, name, faculty, duration, type, branch, year, section, credits, semesterHalf	Course details with scheduling requirements
Faculty	name, department, availability	Faculty information and availability
Rooms	number, capacity, type	Room details and specifications
Exam Scheduler Inputs
Input Type	Required Columns	Description
Exam Courses	code, name, credits, branch, year, students, type	Examination course details
Invigilators	name, department, availability	Invigilator information
Exam Rooms	number, capacity, type	Examination hall details

📁 Project Structure
timetable-generator/
├── server.js                      # Main Express server
├── package.json                   # Dependencies and scripts
├── config/
│   ├── timetableGenerator.js      # Class timetable algorithm
│   └── examScheduler.js           # Exam scheduling algorithm
├── views/
│   ├── index.ejs                  # Home page & class upload
│   ├── timetable.ejs              # Class timetable view
│   ├── faculty-timetable.ejs      # Faculty schedule view
│   ├── exam-upload.ejs            # Exam data upload page
│   └── exam-schedule.ejs          # Exam schedule view
├── public/                        # Static assets (CSS, JS, images)
├── uploads/                       # Temporary CSV upload directory
└── sample_data/                   # Example CSV files
    ├── sample_courses.csv
    ├── sample_faculty.csv
    ├── sample_rooms.csv
    ├── sample_exam_courses.csv
    ├── sample_invigilators.csv
    └── sample_exam_rooms.csv
    
🚀 Installation & Setup

Prerequisites
Node.js (v14.0.0 or higher)
MongoDB (running on localhost:27017)
npm or yarn package manager
Installation Steps
1. Clone the repository

bash
git clone <repository-url>
cd timetable-generator
2. Install dependencies

bash
npm install
3. Start MongoDB

bash
mongod
4. Run the application

bash
node server.js
5. Access the application

http://localhost:3000
📊 CSV File Formats
Courses CSV (Class Timetable)
csv
code,name,faculty,duration,type,branch,year,section,credits,semesterHalf
CS101,Data Structures,Dr. Smith,90,Lecture,CSE,1,A,4,0
CS102L,DS Lab,Dr. Smith,120,Lab,CSE,1,A,2,0
MA101,Calculus,Dr. Brown,60,Tutorial,CSE,1,A,2,2
Field Descriptions:

code: Course code (unique identifier)
name: Course name
faculty: Faculty name (use / for multiple faculty)
duration: 90 (Lecture), 60 (Tutorial), or 120 (Lab) minutes
type: Lecture, Lab, or Tutorial
branch: CSE, DSAI, or ECE
year: 1, 2, 3, or 4
section: A, B, C, etc. (leave empty if no sections)
credits: Number of credits (affects semester split)
semesterHalf:
0 = Full semester (runs both halves)
1 = First half only (pre-mid)
2 = Second half only (post-mid)
Faculty CSV
csv
name,department,availability
Dr. Smith,Computer Science,All
Dr. Jones,Electronics,Monday-Friday
Dr. Brown,Mathematics,All
Rooms CSV
csv
number,capacity,type
R101,60,Classroom
L201,40,Lab
R102,80,Classroom
L202,30,Lab
Exam Courses CSV
csv
code,name,credits,branch,year,students,type
CS101,Data Structures,4,CSE,1,120,Theory
CS201,Algorithms,3,CSE,2,90,Theory
EC101,Circuits,4,ECE,1,150,Theory
DS101,Statistics,3,DSAI,1,100,Theory
Field Descriptions:

students: Total number of students (system allocates 30 per room)
type: Only Theory courses (Lab courses excluded from exams)
Invigilators CSV
csv
name,department,availability
Dr. Smith,Computer Science,All
Dr. Johnson,Electronics,All
Dr. Williams,Data Science,Weekdays
Exam Rooms CSV
csv
number,capacity,type
ER101,40,Exam Hall
ER102,40,Exam Hall
ER103,40,Exam Hall
LAB1,30,Lab
🧠 Algorithm Features
Timetable Generation
The scheduling algorithm applies constraint-based allocation with the following features:

Core Principles
Duration-Based Allocation: Automatically finds consecutive time slots matching course duration (±5 min tolerance)
Even Distribution: Classes distributed across all weekdays
Different Days Enforcement: All sessions of a course scheduled on separate days
Conflict Prevention:
No faculty conflicts (faculty can't be in two places at once)
No room conflicts (rooms can't host two classes simultaneously)
No student group conflicts
Smart Room Allocation: Labs get lab rooms, lectures get classrooms
Elective Slot Protection: Tuesday & Thursday 17:10-18:30 reserved (no regular classes)
Priority Scheduling: Labs scheduled first (need more consecutive slots)
Semester Split Logic
First Half (Pre-Mid Semester):

High-credit courses (≥3 credits)
Core intensive subjects
Courses marked with semesterHalf = 1
Full-semester courses with ≥3 credits
Second Half (Post-Mid Semester):

Lower-credit courses (<3 credits)
New lightweight subjects
Courses marked with semesterHalf = 2
Continuation of full-semester courses
Time Blocks
Morning Block: 09:00 - 10:30 (90 minutes)
Late Morning Block: 10:45 - 13:15 (150 minutes)
Afternoon Block: 14:00 - 18:30 (270 minutes)
Break Times: 10:30-10:45 (Break), 13:15-14:00 (Lunch)
Elective Slots: Tuesday & Thursday 17:10-18:30
Exam Scheduling
The exam scheduler ensures:

Constraints
One exam per day per branch-year combination
30 students per room (automatic room allocation)
1 invigilator per room (automatic assignment)
Same date/time reusable by different branches
Priority scheduling based on credits (higher credits first)
Room-invigilator pairing for tracking
Exam Period
Dates: November 20 - December 6, 2025 (excluding Sundays)
Total Days: 15 examination days
Slots per Day: 2 (Forenoon & Afternoon)
🌐 API Endpoints
Class Timetable Routes
Method	Endpoint	Description
GET	/	Home page with upload interface
POST	/upload/courses	Upload courses CSV
POST	/upload/faculty	Upload faculty CSV
POST	/upload/rooms	Upload rooms CSV
POST	/generate	Generate class timetables
GET	/view	View generated timetables (hierarchical)
GET	/view-faculty	View faculty-wise timetables
GET	/download	Download timetable as CSV
GET	/download-faculty	Download faculty timetable as CSV

Exam Scheduler Routes
Method	Endpoint	Description
GET	/exam	Exam upload interface
POST	/upload/exam-courses	Upload exam courses CSV
POST	/upload/invigilators	Upload invigilators CSV
POST	/upload/exam-rooms	Upload exam rooms CSV
POST	/generate-exam	Generate exam schedule
GET	/view-exam	View exam schedule (Year → Branch navigation)
GET	/download-exam	Download exam schedule as CSV
📖 Usage Guide
Generating Class Timetables
Step 1: Navigate to Class Timetable from home page

Step 2: Upload CSV files:

📚 Upload Courses - Course details with semesterHalf field
👨‍🏫 Upload Faculty - Faculty information
🏫 Upload Rooms - Room specifications
Step 3: Click ⚡ Generate Timetable

Step 4: View timetables with hierarchical navigation:

Level 1: Select Year (1, 2, 3, or 4)
Level 2: Select Branch (CSE, DSAI, ECE)
Level 3: Select Semester Half (First Half / Second Half)
Step 5: Export or print:

📥 Download CSV - For Excel/Sheets
🖨️ Print All - For physical copies
Generating Exam Schedules
Step 1: Navigate to Exam Scheduler from home page

Step 2: Upload CSV files:

📚 Upload Exam Courses - Theory courses only
👨‍🏫 Upload Invigilators - Supervisor details
🏫 Upload Exam Rooms - Examination halls
Step 3: Click ⚡ Generate Exam Schedule

Step 4: View exam schedule organized by:

Year Tabs: Year 1, 2, 3, 4
Branch Tabs: CSE, DSAI, ECE
Step 5: Export or print schedule

🐛 Troubleshooting
Common Issues & Solutions
❌ Problem: "No timetable generated yet"
✅ Solution:

Verify all three CSV files uploaded successfully
Check for confirmation messages after each upload
Click "Generate Timetable" button
Wait for generation to complete (10-30 seconds)
❌ Problem: Some courses not scheduled
✅ Solution:

Check console logs (F12 → Console) for errors
Ensure enough rooms (labs need lab rooms)
Verify faculty availability
Check for duplicate course codes
Reduce courses or increase rooms
❌ Problem: Faculty conflicts showing
✅ Solution:

Review faculty CSV for availability
Check if same faculty in multiple sections
Use faculty timetable view to identify conflicts
Reduce faculty load or add more faculty
❌ Problem: CSV upload fails
✅ Solution:

Verify CSV is comma-separated
Remove blank rows
Check for special characters
Ensure UTF-8 encoding
Try opening in Excel and re-saving as CSV
❌ Problem: Elective slots being used for regular classes
✅ Solution:

Regenerate the timetable
Clear browser cache and refresh
Re-upload all data files
Contact system administrator if persists
❌ Problem: Exam schedule incomplete
✅ Solution:

Add more exam rooms
Increase invigilator count
Check date range (Nov 20 - Dec 6, 2025)
Reduce courses per branch-year
Verify 30 students per room capacity

🎯 Best Practices
Planning Your Timetable
Start Early: Begin data preparation well before semester
Pilot Test: Test with small dataset first
Faculty Input: Consult faculty for availability
Room Survey: Verify all rooms and capacities
Backup Plan: Keep manual override options ready
Data Management
Version Control: Save dated versions of CSV files
Master Spreadsheet: Maintain master Excel file, export to CSV
Regular Backups: Download generated timetables regularly
Change Tracking: Document all modifications
Validation: Cross-check data before upload
Quality Assurance
Before finalizing, check:

✅ All branches have complete schedules
✅ No faculty conflicts
✅ No room double-bookings
✅ Break times respected
✅ Elective slot protection active
✅ Student group schedules validated
✅ Cross-check with academic calendar
🔮 Future Enhancements

Planned Features
🔄 Genetic Algorithm for optimal timetable generation
🔄 Backtracking algorithm for constraint satisfaction
🔄 PDF export with custom formatting
🔄 Multi-section support for large classes
🔄 Student group and batch management
🔄 Room capacity validation against class size
🔄 Custom time slot configuration
🔄 Faculty workload balancing
🔄 Drag-and-drop manual adjustments
🔄 Real-time conflict detection
🔄 Email notifications for updates
🔄 Mobile app integration

Version: 2.0
Last Updated: November 2025


