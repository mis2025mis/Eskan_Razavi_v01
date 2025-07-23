const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./db.sqlite3');

// Initialize database tables
db.serialize(() => {
  // Create AdminSettings table
  db.run(`CREATE TABLE IF NOT EXISTS home_adminsettings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    capactiy INTEGER DEFAULT 0,
    each_person_time INTEGER DEFAULT 24,
    active_guests INTEGER DEFAULT 0,
    highest_settlement_time INTEGER DEFAULT 24
  )`);

  // Create Guests table
  db.run(`CREATE TABLE IF NOT EXISTS home_guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    family TEXT NOT NULL,
    UID INTEGER NOT NULL UNIQUE,
    enter_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    formated_enter_time TEXT,
    duration INTEGER,
    formated_duration TEXT
  )`);

  // Insert default admin settings if not exists
  db.get("SELECT COUNT(*) as count FROM home_adminsettings", (err, row) => {
    if (row.count === 0) {
      db.run(`INSERT INTO home_adminsettings (title, capactiy, each_person_time, active_guests, highest_settlement_time) 
              VALUES ('admin settings', 50, 24, 0, 24)`);
    }
  });
});

// Helper functions
function formatPersianDateTime(dateTime) {
  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, '0');
  
  const hour12 = hour % 12 || 12;
  const meridiem = hour < 12 ? 'ق.ظ' : 'ب.ظ';
  
  return `${year}/${month}/${day} - ${String(hour12).padStart(2, '0')}:${minute} ${meridiem}`;
}

function formatDuration(milliseconds) {
  if (!milliseconds) return "0 ثانیه";
  
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  const parts = [];
  if (days) parts.push(`${days} روز`);
  if (hours) parts.push(`${hours} ساعت`);
  if (minutes) parts.push(`${minutes} دقیقه`);
  if (remainingSeconds) parts.push(`${remainingSeconds} ثانیه`);
  
  return parts.length ? parts.join(" و ") : "0 ثانیه";
}

function updateGuestDuration(guestId, callback) {
  db.get("SELECT enter_time FROM home_guests WHERE id = ?", [guestId], (err, row) => {
    if (err || !row) return callback(err);
    
    const enterTime = new Date(row.enter_time);
    const now = new Date();
    const duration = now - enterTime;
    const formattedDuration = formatDuration(duration);
    
    db.run("UPDATE home_guests SET duration = ?, formated_duration = ? WHERE id = ?", 
           [duration, formattedDuration, guestId], callback);
  });
}

// Routes
app.get('/', (req, res) => {
  const imagesDir = path.join(__dirname, 'public', 'images');
  let imageFiles = [];
  
  try {
    imageFiles = fs.readdirSync(imagesDir).filter(file => 
      /\.(png|jpg|jpeg|gif|webp)$/i.test(file)
    );
  } catch (err) {
    console.log('Images directory not found, using default images');
    imageFiles = ['Haram-1.jpg', 'Haram-2.jpg', 'Haram-3.jpg', 'Graphic-1.jpg', 'Typo-1.jpg'];
  }

  db.get("SELECT * FROM home_adminsettings LIMIT 1", (err, adminSettings) => {
    const capacity = adminSettings ? adminSettings.capactiy : 50;
    const each_person_time = adminSettings ? adminSettings.each_person_time : 24;
    
    const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8')
      .replace('{{API_URL}}', `http://localhost:${PORT}`)
      .replace('{{BACKGROUND_IMAGES}}', JSON.stringify(imageFiles))
      .replace('{{CAPACITY}}', capacity)
      .replace('{{EACH_PERSON_TIME}}', each_person_time);
    
    res.send(html);
  });
});

app.post('/set_admin_settings/', (req, res) => {
  const { capacity, each_person_time, highest_settlement_time } = req.body;
  
  if (!capacity || !each_person_time || !highest_settlement_time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.get("SELECT COUNT(*) as count FROM home_guests", (err, row) => {
    const activeGuests = row ? row.count : 0;
    
    db.run(`UPDATE home_adminsettings SET 
            capactiy = ?, each_person_time = ?, highest_settlement_time = ?, active_guests = ?
            WHERE id = 1`, 
           [capacity, each_person_time, highest_settlement_time, activeGuests], 
           function(err) {
             if (err) {
               return res.status(500).json({ error: "Database error" });
             }
             res.json({ title: "admin settings", status: "success" });
           });
  });
});

app.post('/set_guest/', (req, res) => {
  const { UID, name, family } = req.body;
  
  if (!UID || !name || !family) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Check if guest already exists
  db.get("SELECT * FROM home_guests WHERE UID = ?", [UID], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    
    if (row) {
      return res.json({ status: "created before" });
    }
    
    // Insert new guest
    const enterTime = new Date().toISOString();
    const formattedEnterTime = formatPersianDateTime(enterTime);
    
    db.run(`INSERT INTO home_guests (name, family, UID, enter_time, formated_enter_time, duration, formated_duration) 
            VALUES (?, ?, ?, ?, ?, 0, '0 ثانیه')`, 
           [name, family, UID, enterTime, formattedEnterTime], 
           function(err) {
             if (err) {
               return res.status(500).json({ error: "Database error" });
             }
             
             // Update active guests count
             db.run("UPDATE home_adminsettings SET active_guests = active_guests + 1", (err) => {
               res.status(201).json({ UID: UID, status: "created" });
             });
           });
  });
});

app.get('/admin_page/', (req, res) => {
  db.get("SELECT COUNT(*) as count FROM home_guests", (err, guestRow) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    
    db.get("SELECT * FROM home_adminsettings LIMIT 1", (err, adminRow) => {
      if (err || !adminRow) {
        return res.status(404).json({ error: "Admin settings not found" });
      }
      
      res.json({
        active_guests: guestRow.count,
        capacity: adminRow.capactiy,
        highest_settlement_time: adminRow.highest_settlement_time
      });
    });
  });
});

app.get('/exit_page/', (req, res) => {
  db.get("SELECT * FROM home_adminsettings LIMIT 1", (err, settings) => {
    if (err || !settings) {
      return res.status(404).json({ error: "AdminSettings not found" });
    }

    const activeGuests = settings.active_guests;
    const capacity = settings.capactiy;
    const completed = activeGuests / capacity;
    const completed95 = completed >= 0.95;

    if (completed95) {
      const twentyFourHoursMs = settings.highest_settlement_time * 60 * 60 * 1000;
      
      db.all(`SELECT * FROM home_guests WHERE duration > ? ORDER BY enter_time`, 
             [twentyFourHoursMs], (err, users) => {
        res.json({
          highest_settlement_time: settings.highest_settlement_time,
          capactiy: capacity,
          active_guests: activeGuests,
          percent: (completed * 100).toFixed(2),
          completed_95: completed95,
          users: users || []
        });
      });
    } else {
      res.json({
        highest_settlement_time: settings.highest_settlement_time,
        capactiy: capacity,
        active_guests: activeGuests,
        percent: (completed * 100).toFixed(2),
        completed_95: completed95,
        users: []
      });
    }
  });
});

app.get('/set_exit_page/', (req, res) => {
  db.all("SELECT * FROM home_guests", (err, guests) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    
    // Update durations for all guests
    const updatePromises = guests.map(guest => {
      return new Promise((resolve) => {
        const enterTime = new Date(guest.enter_time);
        const now = new Date();
        const duration = now - enterTime;
        const formattedDuration = formatDuration(duration);
        
        db.run("UPDATE home_guests SET duration = ?, formated_duration = ? WHERE id = ?", 
               [duration, formattedDuration, guest.id], () => {
          guest.duration = duration;
          guest.formated_duration = formattedDuration;
          resolve(guest);
        });
      });
    });
    
    Promise.all(updatePromises).then(updatedGuests => {
      res.json({ Data: updatedGuests });
    });
  });
});

app.post('/set_exit/', (req, res) => {
  const { UID } = req.body;
  
  if (!UID || !String(UID).match(/^\d+$/)) {
    return res.status(400).json({ error: "Invalid UID" });
  }

  db.get("SELECT * FROM home_guests WHERE UID = ?", [UID], (err, guest) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    
    if (!guest) {
      return res.json({ status: "there is no such person" });
    }
    
    // Delete guest
    db.run("DELETE FROM home_guests WHERE UID = ?", [UID], (err) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      
      // Update active guests count
      db.run("UPDATE home_adminsettings SET active_guests = active_guests - 1", (err) => {
        res.json({ status: "person removed" });
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});