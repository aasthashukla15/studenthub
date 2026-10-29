# StudentHub - Student Record Management System

A complete, beginner-friendly college project: a modern blue-and-white dashboard for managing student records.

- **Frontend:** HTML5, CSS3, vanilla JavaScript (no frameworks)
- **Backend:** Node.js, Express.js, Mongoose, dotenv
- **Database:** MongoDB Atlas (cloud MongoDB)

Express serves both the website and the REST API, so the whole project runs as **one server** on one port.

---

## Table of contents

1. [Features](#1-features)
2. [Folder structure](#2-folder-structure)
3. [Setup and run](#3-setup-and-run)
4. [Connecting MongoDB Atlas](#4-connecting-mongodb-atlas)
5. [API reference](#5-api-reference)
6. [Testing guide](#6-testing-guide)
7. [Indexing and query optimization](#7-indexing-and-query-optimization)
8. [Replication](#8-replication-separate-mongodb-task)
9. [Backup and restore](#9-backup-and-restore-separate-from-the-app)
10. [Deployment](#10-deployment-frontend--backend-together)
11. [Ten viva questions](#11-ten-likely-viva-questions)
12. [Short presentation for your teacher](#12-short-presentation-for-your-teacher)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Features

- **Dashboard:** total students, total departments, average CGPA, students in a chosen semester, and the 5 most recent students. All numbers are calculated by MongoDB, not hardcoded.
- **Student table:** registration number, name, email, department, semester, CGPA, and Edit / Delete buttons.
- **Add / Edit form** in a modal, with validation in the browser **and** on the server.
- **Search** by name or registration number, **filter** by department and semester, and a **Clear filters** button.
- **Loading spinner, empty state and error state** with a Retry button.
- **Responsive:** the table turns into stacked cards on phones.
- **Unique registration numbers:** enforced by a MongoDB unique index. Duplicates show a clear message under the field.
- Works with an **empty database**. Sample data is optional (`npm run seed`).

> **"Students in semester" card:** it shows the highest semester found in your data by default. Use the small dropdown on the card to look at any semester from 1 to 8.

---

## 2. Folder structure

```
studenthub/
├── public/                        <- the website (served by Express)
│   ├── index.html                 <- page structure
│   ├── css/style.css              <- blue & white theme, responsive rules
│   └── js/app.js                  <- all frontend logic (fetch calls, rendering, validation)
├── src/
│   ├── config/db.js               <- connects to MongoDB using MONGODB_URI
│   ├── models/Student.js          <- Mongoose schema + the 3 indexes
│   ├── routes/studentRoutes.js    <- URL -> controller mapping
│   └── controllers/studentController.js   <- CRUD + stats logic, validation, error handling
├── scripts/
│   ├── index-demo.js              <- indexing demo (COLLSCAN vs IXSCAN)
│   └── seed.js                    <- optional sample data
├── .env.example                   <- template for your .env
├── .gitignore                     <- ignores .env, node_modules, backups
├── package.json
├── server.js                      <- starts Express
└── README.md
```

---

## 3. Setup and run

**You need:** [Node.js](https://nodejs.org) version 18 or newer, and a free [MongoDB Atlas](https://www.mongodb.com/atlas) account.

```bash
# 1. Go into the project folder
cd studenthub

# 2. Install the dependencies (express, mongoose, dotenv)
npm install

# 3. Create your own .env file from the template
#    macOS / Linux:
cp .env.example .env
#    Windows (Command Prompt):
copy .env.example .env

# 4. Open .env and paste your MongoDB Atlas connection string (see section 4)

# 5. (Optional) add sample students
npm run seed

# 6. Start the server
npm start
```

Open **http://localhost:3000** in your browser.

Other commands:

| Command | What it does |
|---|---|
| `npm start` | Starts the server |
| `npm run dev` | Starts the server and restarts it when files change |
| `npm run seed` | Adds sample students (skips ones that already exist) |
| `npm run seed -- --clear` | Deletes **all** students, then adds the samples |
| `npm run index-demo` | Runs the indexing demo (section 7) |

---

## 4. Connecting MongoDB Atlas

1. Sign in at <https://www.mongodb.com/atlas> and create a **free cluster** (M0). Any cloud provider and region is fine.
2. **Database Access** -> *Add New Database User*. Choose a username and password and give it the role *Read and write to any database*.
   Tip: use a password with only letters and numbers. If it contains special characters such as `@ : / ?`, they must be URL-encoded in the connection string.
3. **Network Access** -> *Add IP Address* -> *Add Current IP Address*.
   (For a quick demo you may use `0.0.0.0/0`, which allows any IP. Do not leave that on for real data.)
4. **Database** -> your cluster -> **Connect** -> **Drivers** -> copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<username>` and `<password>`, and add the database name **`/studenthub`** before the `?`:
   ```
   mongodb+srv://myuser:mypassword@cluster0.abcde.mongodb.net/studenthub?retryWrites=true&w=majority
   ```
6. Paste it into your `.env` file:
   ```
   MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.abcde.mongodb.net/studenthub?retryWrites=true&w=majority
   PORT=3000
   ```
7. Run `npm start`. You should see:
   ```
   MongoDB connected -> host: ... | database: studenthub
   StudentHub is running at http://localhost:3000
   ```

The database and the `students` collection are created automatically the first time you add a student. The credentials live only in `.env`, which is listed in `.gitignore`, so they are never uploaded to GitHub.

If the connection fails, the server prints a `[DATABASE ERROR]` message with the common causes and stops.

---

## 5. API reference

Base URL: `http://localhost:3000/api`

| Method | Endpoint | Purpose | Success code |
|---|---|---|---|
| POST | `/students` | Create a student | 201 |
| GET | `/students` | List students. Optional query: `search`, `department`, `semester`, `limit` | 200 |
| GET | `/students/:id` | Get one student | 200 |
| PUT | `/students/:id` | Update a student (send all fields) | 200 |
| DELETE | `/students/:id` | Delete a student | 200 |
| GET | `/stats` | Dashboard numbers. Optional query: `semester` | 200 |

Example request body for POST / PUT:

```json
{
  "name": "Aarav Sharma",
  "registrationNumber": "CS2023001",
  "email": "aarav.sharma@college.edu",
  "department": "Computer Science",
  "semester": 5,
  "cgpa": 8.72
}
```

`cgpa` is optional. Registration numbers are stored in upper case and emails in lower case.

Example error responses:

| Situation | Status | Example `message` |
|---|---|---|
| Missing / invalid fields | 400 | `Please fix the highlighted fields` (with an `errors` object per field) |
| Invalid ID format | 400 | `Invalid student ID` |
| Student does not exist | 404 | `Student not found` |
| Duplicate registration number | 409 | `A student with this registration number already exists` |
| Database problem | 500 | `Something went wrong on the server...` |

Example response of `GET /api/stats`:

```json
{
  "success": true,
  "data": {
    "totalStudents": 18,
    "totalDepartments": 7,
    "departments": ["Business Administration", "Civil Engineering", "..."],
    "averageCgpa": 7.87,
    "currentSemester": 7,
    "studentsInSemester": 4
  }
}
```

---

## 6. Testing guide

Start the server with `npm start` and open <http://localhost:3000>. Everything below can be done in the browser. Postman is optional (see 6.2).

### 6.1 Testing in the browser

| # | Feature | Steps | Expected result |
|---|---|---|---|
| 1 | **Add a student** | Click **Add Student**, fill all fields (e.g. `CS2025001`), click **Save Student** | Modal closes, green toast "Student added successfully", the student appears in the table and in "Recently added", dashboard numbers increase |
| 2 | **View all students** | Scroll to **Student Records** | All students are listed, newest first, with the count shown above the table |
| 3 | **Search** | Type part of a name or a registration number in the search box | The table updates after a short pause to show only matching students |
| 3b | **Filter** | Choose a department, then a semester | Only students matching both filters are shown. **Clear filters** resets everything |
| 4 | **Edit a student** | Click the pencil icon, change the CGPA, click **Update Student** | Toast "Student updated successfully", the table shows the new CGPA, the dashboard average changes |
| 5 | **Delete a student** | Click the trash icon, then **Yes, delete** | Toast "Student deleted successfully", the row disappears, the totals decrease |
| 6 | **Duplicate registration number** | Add a student using a registration number that already exists (letter case does not matter) | The form stays open and shows "This registration number is already in use" under the field (message comes from the server) |
| 7 | **Invalid inputs** | Submit an empty form; then try an email like `abc`, a CGPA of `11`, a registration number with spaces | Red messages appear under each wrong field and nothing is saved |
| 8 | **Empty state** | Search for `zzzzzz` | "No students match your search" with a **Clear filters** button. With an empty database you see "No students yet" with an **Add Student** button |
| 9 | **Loading state** | Reload the page and watch the table area | A spinner appears briefly while data loads |
| 10 | **Mobile layout** | Narrow the browser window below 720 px (or use the browser's device mode) | Table rows turn into cards, filters stack vertically |

**MongoDB connection error test**

1. Stop the server (`Ctrl + C`).
2. In `.env` change the password in `MONGODB_URI` to something wrong.
3. Run `npm start`.
4. Expected: a `[DATABASE ERROR] Could not connect to MongoDB` message listing the common reasons, and the server stops.
5. Also try deleting the `.env` file: you get a "MONGODB_URI is not set" message.
6. Restore the correct value afterwards.

**Index verification** -> section 7. **Backup and restore verification** -> section 9.

### 6.2 Optional: testing the API with Postman

1. Open Postman and create a new request. Base URL: `http://localhost:3000/api`.
2. For POST and PUT choose **Body -> raw -> JSON**.

| Request | Body | Expected |
|---|---|---|
| `POST /students` | the example JSON from section 5 | 201 and the new student with an `_id` |
| `GET /students` | none | 200 and a list |
| `GET /students?search=aarav` | none | 200, only matching students |
| `GET /students?department=Computer Science&semester=5` | none | 200, filtered list |
| `GET /students/<paste _id>` | none | 200 and one student |
| `PUT /students/<paste _id>` | the JSON with a changed `cgpa` | 200 and the updated student |
| `DELETE /students/<paste _id>` | none | 200 |
| `GET /students/<same _id again>` | none | 404 `Student not found` |
| `GET /students/123` | none | 400 `Invalid student ID` |
| `POST /students` twice with the same registration number | same JSON | second call returns 409 |
| `POST /students` with `{}` | `{}` | 400 with an `errors` object |
| `GET /stats` | none | 200 and the dashboard numbers |

Same thing with curl:

```bash
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","registrationNumber":"T001","email":"t@college.edu","department":"Computer Science","semester":2,"cgpa":7.5}'

curl http://localhost:3000/api/students
curl http://localhost:3000/api/stats
```

---

## 7. Indexing and query optimization

### What is already implemented

`src/models/Student.js` defines three indexes (plus MongoDB's default `_id` index):

| Index | Type | Used for |
|---|---|---|
| `registrationNumber` | **Unique** | Prevents duplicate registration numbers; fast lookup by registration number |
| `department` | Normal | The "Filter by department" dropdown |
| `semester` | Normal | The "Filter by semester" dropdown and the dashboard semester card |

Mongoose creates these automatically when the server (or a script) starts.

### Demo script (easiest way for the practical)

```bash
npm run index-demo            # 30,000 generated students
npm run index-demo -- 100000  # or choose your own number
```

The script:

1. Lists the indexes on your real `students` collection.
2. Creates a **temporary** collection `students_index_demo` with fake students (your real data is never touched).
3. Runs `explain("executionStats")` on two queries **without** indexes.
4. Creates the same indexes and runs the **same two queries again**.
5. Prints a before / after table and deletes the temporary collection.

Typical result (your numbers will differ):

```
BEFORE: department + semester -> COLLSCAN, docs examined = 30000
AFTER : department + semester -> IXSCAN,   docs examined = roughly 3,750 (only the documents matched by the one index MongoDB picks, far fewer than 30000)
BEFORE: registrationNumber    -> COLLSCAN, docs examined = 30000
AFTER : registrationNumber    -> IXSCAN,   docs examined = 1
```

### Doing it by hand in mongosh

Connect (replace the placeholders):

```bash
mongosh "mongodb+srv://YOUR_CLUSTER.mongodb.net/studenthub" --username YOUR_USERNAME
```

```javascript
// 1. List the indexes
db.students.getIndexes()

// 2. See how a query runs, with statistics
db.students.find({ department: "Computer Science" }).explain("executionStats")

// 3. Compare "before": remove the department index
db.students.dropIndex("department_1")
db.students.find({ department: "Computer Science" }).explain("executionStats")   // look for COLLSCAN

// 4. Compare "after": add the index back
db.students.createIndex({ department: 1 })
db.students.find({ department: "Computer Science" }).explain("executionStats")   // look for IXSCAN
```

With only 18 sample students the time difference is too small to see. That is why `npm run index-demo` generates thousands of documents. You can also pad your real collection, but the script is safer.

### How to read `explain("executionStats")`

| Field | Meaning |
|---|---|
| `queryPlanner.winningPlan` | The plan MongoDB chose. Look for `COLLSCAN` or `IXSCAN` inside it |
| `executionStats.nReturned` | Documents returned |
| `executionStats.totalDocsExamined` | Documents MongoDB had to read |
| `executionStats.totalKeysExamined` | Index entries read (0 for a COLLSCAN) |
| `executionStats.executionTimeMillis` | Time taken |

- **COLLSCAN (collection scan):** MongoDB reads **every** document. Fine for 18 students, slow for millions.
- **IXSCAN (index scan):** MongoDB uses the index to jump to matching documents. `totalDocsExamined` is close to `nReturned`.
- A good query has `totalDocsExamined` close to `nReturned`.

### Honest notes (good for viva)

- The **department and semester filters** are exact matches, so they use the indexes.
- The **search box** uses a case-insensitive, "contains" regular expression. That kind of pattern cannot make efficient use of a normal index, so search scans documents. This is fine at college scale. A text index or an anchored prefix search would be the next improvement.
- For queries that filter on department **and** semester together, a single **compound index** `{ department: 1, semester: 1 }` would be even better. It was left out on purpose to keep the number of indexes reasonable, as the project requires.
- Indexes speed up reads but make writes slightly slower and use storage, so we only index fields we actually filter on.

---

## 8. Replication (separate MongoDB task)

> **Important:** replication is configured **inside MongoDB**, not in the Node.js code. StudentHub does not set up replication. It simply connects to a replica set through the connection string. Everything in this section is a separate demonstration.

### 8.1 Concepts

- **Replication** means keeping copies of the same data on several MongoDB servers, so one server failing does not lose data or stop the application.
- A group of servers holding the same data is called a **replica set**.
- **Primary node:** the one server that accepts all **writes**. Reads normally go here too.
- **Secondary nodes:** copy the primary's changes (using its operation log, the *oplog*) and keep an identical copy of the data.
- **Automatic failover:** if the primary stops responding, the remaining members hold an **election** (usually within seconds) and one secondary becomes the new primary. The application driver notices and continues with the new primary.
- A replica set needs an **odd number of voting members** (commonly 3) so a majority can always be reached.

### 8.2 Option A: MongoDB Atlas (no installation)

Every Atlas cluster, including the free one, is already a replica set (typically 3 nodes), so you can show this without any setup.

**Dashboard steps**

1. Atlas -> **Database** -> click your cluster name.
2. Open the cluster overview. It lists the cluster's nodes, with their **roles** shown as **Primary** and **Secondary**.
3. Take a screenshot for your report.

**Verify from the shell** (works on all tiers):

```javascript
// mongosh "mongodb+srv://YOUR_CLUSTER.mongodb.net/studenthub" --username YOUR_USERNAME
db.hello()
```

Look at:

- `isWritablePrimary: true` -> you are connected to the primary
- `hosts` -> all members of the replica set
- `primary` -> the current primary
- `setName` -> the replica set name

If your user and tier allow it, you can also run `rs.status()`. It lists every member with `stateStr` of `PRIMARY` or `SECONDARY`. Some Atlas tiers restrict this command; use `db.hello()` if it is refused.

**Failover test on Atlas:** Atlas offers a *Test Resilience* / primary-failover option, but it may only be available on paid dedicated clusters, not the free tier. If you do not see it, use Option B below for a live failover demonstration.

### 8.3 Option B: a local 3-node replica set (full hands-on demo)

You need MongoDB Community Server installed locally (`mongod` and `mongosh` on your PATH).

**Step 1: create three data folders and start three servers**

macOS / Linux:

```bash
mkdir -p ~/rs-demo/node1 ~/rs-demo/node2 ~/rs-demo/node3

mongod --replSet rs0 --port 27017 --dbpath ~/rs-demo/node1 --bind_ip localhost --fork --logpath ~/rs-demo/node1.log
mongod --replSet rs0 --port 27018 --dbpath ~/rs-demo/node2 --bind_ip localhost --fork --logpath ~/rs-demo/node2.log
mongod --replSet rs0 --port 27019 --dbpath ~/rs-demo/node3 --bind_ip localhost --fork --logpath ~/rs-demo/node3.log
```

Windows (create the folders first, then run each command in its **own** Command Prompt window and leave them open):

```bat
mkdir C:\rs-demo\node1 C:\rs-demo\node2 C:\rs-demo\node3

mongod --replSet rs0 --port 27017 --dbpath C:\rs-demo\node1 --bind_ip localhost
mongod --replSet rs0 --port 27018 --dbpath C:\rs-demo\node2 --bind_ip localhost
mongod --replSet rs0 --port 27019 --dbpath C:\rs-demo\node3 --bind_ip localhost
```

**Step 2: initiate the replica set** (once)

```bash
mongosh --port 27017
```

```javascript
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "localhost:27017" },
    { _id: 1, host: "localhost:27018" },
    { _id: 2, host: "localhost:27019" }
  ]
})
```

**Step 3: verify the status** (wait about 10 seconds)

```javascript
rs.status().members.map(m => ({ name: m.name, state: m.stateStr }))
// one PRIMARY and two SECONDARY
```

**Step 4: show that data is replicated**

On the primary (port 27017):

```javascript
use studenthub
db.students.insertOne({ name: "Replica Test", registrationNumber: "REPL001", email: "r@college.edu", department: "Computer Science", semester: 1 })
```

In a new terminal, connect to a **secondary** and read the same data:

```bash
mongosh "mongodb://localhost:27018/?directConnection=true"
```

```javascript
db.getMongo().setReadPref("secondaryPreferred")   // allow reading from a secondary
use studenthub
db.students.find({ registrationNumber: "REPL001" })   // the document is here too
```

**Step 5: show automatic failover**

On the primary:

```javascript
rs.stepDown(60)   // primary steps down and an election starts
```

Then, from any node:

```javascript
rs.status().members.map(m => ({ name: m.name, state: m.stateStr }))
// a different node is now PRIMARY
```

For a more dramatic demo, stop the primary process itself (press `Ctrl + C` in its window on Windows, or `mongosh --port 27017 --eval "db.getSiblingDB('admin').shutdownServer({force:true})"` on macOS / Linux), then run `rs.status()` on another node and watch a secondary get elected.

**Step 5b (optional): run StudentHub on the local replica set**

Set this in `.env`, then `npm start`:

```
MONGODB_URI=mongodb://localhost:27017,localhost:27018,localhost:27019/studenthub?replicaSet=rs0
```

Stepping down the primary while the app is open shows the driver reconnecting to the new primary. A request made during the election may fail for a few seconds, then work again.

**Cleanup:** stop the three `mongod` processes and delete the `rs-demo` folder.

---

## 9. Backup and restore (separate from the app)

These commands use the MongoDB **Database Tools** (`mongodump`, `mongorestore`). Install them from <https://www.mongodb.com/try/download/database-tools> and check with `mongodump --version`. They are **not part of the Node.js application**.

Replace the placeholders in capitals with your own values. If your password has special characters, URL-encode it.

### 9.1 Back up

```bash
# A folder-based backup of the studenthub database
mongodump --uri="mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net/studenthub" --out=./backup
```

This creates `backup/studenthub/students.bson` (the data) and `students.metadata.json` (collection options and index definitions).

Single compressed file alternative:

```bash
mongodump --uri="mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net/studenthub" --archive=studenthub-backup.gz --gzip
```

For a local server: `mongodump --uri="mongodb://localhost:27017/studenthub" --out=./backup`

### 9.2 Restore

**Safe restore into a different database (recommended for the demo, nothing is overwritten):**

```bash
mongorestore --uri="mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net" \
  --nsInclude="studenthub.*" --nsFrom="studenthub.*" --nsTo="studenthub_restored.*" ./backup
```

**Restore over the original database** (`--drop` removes each existing collection before restoring it):

```bash
mongorestore --uri="mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net" \
  --nsInclude="studenthub.*" --drop ./backup
```

**Restore from the compressed archive:**

```bash
mongorestore --uri="mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net" \
  --archive=studenthub-backup.gz --gzip --nsInclude="studenthub.*" --drop
```

(On Windows Command Prompt, put the whole command on one line instead of using `\`.)

### 9.3 Verify the restored records

```bash
mongosh "mongodb+srv://YOUR_CLUSTER.mongodb.net/studenthub_restored" --username YOUR_USERNAME
```

```javascript
db.students.countDocuments()      // should equal the count in the original database
db.students.find().limit(3)       // sample records look right
db.students.getIndexes()          // the unique and other indexes were restored too
```

Compare with the original:

```javascript
use studenthub
db.students.countDocuments()
```

If you restored over the original database, you can also just open StudentHub and check that the students are back.

**Full disaster demo**

1. Take a backup (9.1).
2. Delete data on purpose: in mongosh, `use studenthub` then `db.students.deleteMany({})` (the website now shows "No students yet").
3. Restore with `--drop` (9.2).
4. Refresh the website. The students are back.

### 9.4 Why backups are needed even with replication

Replication protects against a **server failing**. It does **not** protect against **mistakes**, because every change is copied to the secondaries almost instantly, including bad ones:

- Someone accidentally deletes records or drops a collection -> the secondaries delete them too.
- A bug in the code corrupts data -> the corrupted data is replicated everywhere.
- Malware, a hacked account, or a whole data-centre problem can affect every member.

Replication = **availability** (the system keeps running). Backup = **recoverability** (you can go back to an earlier good copy). You need both.

Note: Atlas's automated cloud backups are generally not available on the free tier, which is why `mongodump` is used here. Backup files contain real data, so keep them private. The `backup/` folder and `*.gz` files are already in `.gitignore`.

---

## 10. Deployment (frontend + backend together)

Because Express serves the `public/` folder **and** the API, you deploy **one** web service. The frontend calls `/api/...` on the same address, so there are no CORS settings and no URLs to change.

### Deploying on Render (free tier works for a demo)

1. **Push the project to GitHub** (`.env` and `node_modules` are ignored automatically):
   ```bash
   git init
   git add .
   git commit -m "StudentHub"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/studenthub.git
   git push -u origin main
   ```
2. On <https://render.com> choose **New -> Web Service** and connect your GitHub repository.
3. Settings:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Under **Environment Variables** add `MONGODB_URI` with your Atlas connection string (including `/studenthub`). Do **not** set `PORT`; Render provides it and the app reads `process.env.PORT`.
5. In **Atlas -> Network Access**, allow Render to connect. Render's outgoing IP addresses can change on free plans, so for a demo you may need to allow `0.0.0.0/0`. Use a strong database password if you do.
6. Deploy. Render gives you a public URL such as `https://studenthub.onrender.com`. Free services may "sleep" after inactivity, so the first load can take a while.

Railway and any VPS work the same way: run `npm install`, set `MONGODB_URI`, run `npm start`.

---

## 11. Ten likely viva questions

**1. What is MongoDB and why did you use it?**
MongoDB is a NoSQL database that stores data as flexible JSON-like documents inside collections. It fits well with JavaScript and Node.js because documents look like JavaScript objects, and we do not need to define tables in advance.

**2. What is Mongoose and what does the schema do?**
Mongoose is a library that lets Node.js talk to MongoDB using models. The schema in `Student.js` defines the fields, their types, required fields, the CGPA range and the indexes, so invalid data is rejected before it is saved.

**3. What is CRUD and how is it done here?**
CRUD means Create, Read, Update, Delete. We map them to HTTP methods: POST creates, GET reads, PUT updates and DELETE deletes, all under `/api/students`.

**4. What is a REST API and what does `fetch()` do?**
A REST API exposes data through URLs and HTTP methods and returns JSON. `fetch()` is the browser function that sends those requests from `app.js` to the Express server and gets the JSON response back.

**5. What is middleware in Express? Which do you use?**
Middleware is a function that runs between the request and the response. `express.json()` reads JSON request bodies, `express.static()` serves the HTML/CSS/JS files, and our error handler catches bad JSON.

**6. How do you prevent duplicate registration numbers?**
With a **unique index** on `registrationNumber`. If a duplicate is inserted, MongoDB throws error code 11000. The controller catches it and returns a 409 response with a clear message that the form shows under the field.

**7. What is an index? What are COLLSCAN and IXSCAN?**
An index is a sorted lookup structure, like the index at the back of a book. Without one, MongoDB does a **COLLSCAN** (reads every document). With one it does an **IXSCAN** (jumps straight to matches), which is much faster on large data. We check this with `explain("executionStats")` and compare `totalDocsExamined`.

**8. What is replication? Explain primary, secondary and failover.**
Replication keeps copies of the data on multiple servers called a replica set. The **primary** takes all writes, the **secondaries** copy it. If the primary fails, the members hold an election and a secondary becomes the new primary automatically. That is **failover**. It improves availability and protects against hardware failure.

**9. If we have replication, why do we still need backups?**
Replication copies everything instantly, including mistakes like accidental deletes or corrupted data. A backup (`mongodump`) is a separate snapshot from an earlier time that we can restore with `mongorestore`. Replication is for uptime, backup is for recovery.

**10. How do you handle validation and secrets (`.env`)?**
Inputs are validated twice: in the browser for quick feedback and on the server (plus the Mongoose schema) for safety, because the browser can be bypassed. The database password is stored in `.env`, loaded with `dotenv`, and `.env` is in `.gitignore`, so credentials are never in the code or on GitHub.

---

## 12. Short presentation for your teacher

> "StudentHub is a Student Record Management System. It has a dashboard that shows total students, departments, the average CGPA and the number of students in a semester, plus a full student table where we can add, search, filter, edit and delete records.
>
> The frontend is plain HTML, CSS and JavaScript. It talks to a Node.js and Express backend using `fetch()` and REST APIs. All data is stored in MongoDB Atlas using Mongoose, and the connection string is kept safely in a `.env` file.
>
> Validation happens in the browser and on the server, and a unique index stops duplicate registration numbers.
>
> For the database topics in our syllabus I also demonstrated three things. First, **indexing**: I created indexes on registration number, department and semester, and used `explain` to show that a query changes from COLLSCAN to IXSCAN and examines far fewer documents. Second, **replication**: I showed the primary and secondary nodes of a replica set and how a new primary is elected when the old one steps down. Third, **backup and restore** with `mongodump` and `mongorestore`, where I deleted data and then recovered it.
>
> The whole project runs as one Express server, so it can be deployed as a single service."

**Suggested 5-minute demo order:** dashboard -> add a student -> try a duplicate registration number -> search and filter -> edit -> delete -> `npm run index-demo` -> Atlas replica-set screenshot (or the local failover) -> backup and restore.

---

## 13. Troubleshooting

| Problem | Fix |
|---|---|
| `MONGODB_URI is not set` | Create `.env` by copying `.env.example` and paste your connection string |
| `Could not connect to MongoDB` / timeout | Check username and password, add your IP in Atlas -> Network Access, check your internet |
| `bad auth : Authentication failed` | Wrong username or password. URL-encode special characters in the password |
| Warning "using test database" | Add `/studenthub` after `.net` in your connection string |
| Port already in use (`EADDRINUSE`) | Change `PORT` in `.env`, or stop the other program on that port |
| Page loads but shows "Cannot reach the server" | The Node server is not running. Run `npm start` |
| `E11000 duplicate key` while seeding | Not an issue. The seed script skips students that already exist |
| Changes to files do not show up | Use `npm run dev`, or restart the server. For CSS/JS changes do a hard refresh (`Ctrl + Shift + R`) |
