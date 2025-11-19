# 🕒 Automated Timetable Generator

The **Automated Timetable Generator** is a comprehensive **MERN stack** application that automates the creation of conflict-free academic schedules. It generates both regular class timetables and examination schedules with intelligent resource allocation and constraint-based optimization — saving time, reducing human error, and ensuring efficient utilization of resources.

---

## ⚙️ Tech Stack

* **Backend:** Node.js, Express.js  
* **Database:** MongoDB  
* **File Upload:** Multer
* **CSV Parsing:** csv-parser
* **Frontend:** HTML5, CSS3, EJS Templates  
* **Language:** JavaScript (ES6+)

---

## ✨ Features

### 📚 Class Timetable Module

* CSV upload for courses, faculty, and rooms
* Automated timetable generation with conflict resolution
* Duration-based scheduling:
  * **Lectures:** 2 sessions × 90 minutes (on different days)
  * **Tutorials:** 1 session × 60 minutes
  * **Labs:** 1 session × 120 minutes
* Semester split management (Pre-mid and Post-mid)
* Smart slot allocation with consecutive time blocks
* Different days enforcement for course sessions
* Elective slot protection (Tuesday & Thursday 17:10-18:30)
* Multi-branch support (CSE, DSAI, ECE)
* Section management for multiple classes
* Color-coded timetable view:
  * 🔵 **Blue** - Lectures
  * 🟢 **Green** - Tutorials
  * 🔴 **Red** - Labs
  * 🟡 **Yellow** - Electives
* Smart room allocation (Labs → Lab rooms, Lectures → Classrooms)
* Faculty-wise timetable view
* Export timetable to CSV
* Print-friendly view
* Modern, responsive UI with hierarchical navigation

### 📋 Exam Scheduler Module

* Automated exam schedule generation (Nov 20 - Dec 6, 2025)
* One exam per day per branch-year constraint
* Resource allocation (30 students per room, 1 invigilator per room)
* Dual time slots (Forenoon: 9 AM-12 PM, Afternoon: 2 PM-5 PM)
* Priority scheduling based on credits
* Cross-branch optimization
* Room-invigilator pairing
* Export exam schedule to CSV

---

## 📥 Inputs

The system accepts data through CSV files:

### Class Timetable Inputs

| Input Type | Required Columns | Description |
|------------|------------------|-------------|
| **Courses** | code, name, faculty, duration, type, branch, year, section, credits, semesterHalf | Course details with scheduling requirements |
| **Faculty** | name, department, availability | Faculty information and availability |
| **Rooms** | number, capacity, type | Room details and specifications |

### Exam Scheduler Inputs

| Input Type | Required Columns | Description |
|------------|------------------|-------------|
| **Exam Courses** | code, name, credits, branch, year, students, type | Examination course details |
| **Invigilators** | name, department, availability | Invigilator information |
| **Exam Rooms** | number, capacity, type | Examination hall details |

---

## 📁 Project Structure
```
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
```

---

## 🧠 Algorithm Features

### Timetable Generation

The scheduling algorithm applies **constraint-based allocation** with the following features:

#### Core Principles

* **Duration-Based Allocation:** Automatically finds consecutive time slots matching course duration (±5 min tolerance)
* **Even Distribution:** Classes distributed across all weekdays
* **Different Days Enforcement:** All sessions of a course scheduled on separate days
* **Conflict Prevention:** 
  * No faculty conflicts (faculty can't be in two places at once)
  * No room conflicts (rooms can't host two classes simultaneously)
  * No student group conflicts
* **Smart Room Allocation:** Labs get lab rooms, lectures get classrooms
* **Elective Slot Protection:** Tuesday & Thursday 17:10-18:30 reserved (no regular classes)
* **Priority Scheduling:** Labs scheduled first (need more consecutive slots)
* **Automatic Retry Mechanism:** Multiple strategies for difficult-to-place courses
* **Distribution Statistics:** Logged in console for verification

#### Semester Split Logic

**First Half (Pre-Mid Semester):**

* High-credit courses (≥3 credits)
* Core intensive subjects
* Courses marked with `semesterHalf = 1`
* Full-semester courses with ≥3 credits

**Second Half (Post-Mid Semester):**

* Lower-credit courses (<3 credits)
* New lightweight subjects
* Courses marked with `semesterHalf = 2`
* Continuation of full-semester courses

#### Time Blocks

* **Morning Block:** 09:00 - 10:30 (90 minutes)
* **Late Morning Block:** 10:45 - 13:15 (150 minutes)
* **Afternoon Block:** 14:00 - 18:30 (270 minutes)
* **Break Times:** 10:30-10:45 (Break), 13:15-14:00 (Lunch)
* **Elective Slots:** Tuesday & Thursday 17:10-18:30

### Exam Scheduling

The exam scheduler ensures:

#### Constraints

* **One exam per day** per branch-year combination
* **30 students per room** (automatic room allocation)
* **1 invigilator per room** (automatic assignment)
* **Same date/time reusable** by different branches
* **Priority scheduling** based on credits (higher credits first)
* **Room-invigilator pairing** for tracking

#### Exam Period

* **Dates:** November 20 - December 6, 2025 (excluding Sundays)
* **Total Days:** 15 examination days
* **Slots per Day:** 2 (Forenoon & Afternoon)

---

## 🌐 API Endpoints

### Class Timetable Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Home page with upload interface |
| `POST` | `/upload/courses` | Upload courses CSV |
| `POST` | `/upload/faculty` | Upload faculty CSV |
| `POST` | `/upload/rooms` | Upload rooms CSV |
| `POST` | `/generate` | Generate class timetables |
| `GET` | `/view` | View generated timetables (hierarchical) |
| `GET` | `/view-faculty` | View faculty-wise timetables |
| `GET` | `/download` | Download timetable as CSV |
| `GET` | `/download-faculty` | Download faculty timetable as CSV |

### Exam Scheduler Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/exam` | Exam upload interface |
| `POST` | `/upload/exam-courses` | Upload exam courses CSV |
| `POST` | `/upload/invigilators` | Upload invigilators CSV |
| `POST` | `/upload/exam-rooms` | Upload exam rooms CSV |
| `POST` | `/generate-exam` | Generate exam schedule |
| `GET` | `/view-exam` | View exam schedule (Year → Branch navigation) |
| `GET` | `/download-exam` | Download exam schedule as CSV |

---

## 📤 Output Generated

### Class Timetables

* **Hierarchical View:** Year → Branch → Section → Semester Half
* **Multiple Formats:** 
  * Branch-wise timetables (student view)
  * Faculty-wise timetables (faculty view)
* **Color-Coded Display:** Visual distinction for session types
* **Export Options:**
  * Download as CSV for Excel/Google Sheets
  * Print-friendly format for physical distribution
* **Details Shown:**
  * Course name and code
  * Faculty assigned
  * Room number
  * Time slot
  * Session type (Lecture/Tutorial/Lab)

### Exam Schedules

* **Organized Display:** Year → Branch hierarchy
* **Complete Information:**
  * Exam date and day
  * Time slot (Forenoon/Afternoon)
  * Course code and name
  * Room allocation
  * Invigilator assignment
* **Export Options:**
  * CSV download
  * Print-friendly format


---

**Version:** 2.0  
**Last Updated:** November 2025  
**Status:** Production Ready
**classtimetable**