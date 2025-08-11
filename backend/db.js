const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'files.db'));

db.run('PRAGMA foreign_keys = ON');

db.serialize(() => {
  // Create the projects table
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create the chats table with project_id foreign key
  db.run(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT DEFAULT 'Untitled',
      messages TEXT,
      project_id INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Check if the chats table needs migration for project_id column
  db.get(`PRAGMA table_info(chats)`, (err, rows) => {
    if (err) {
      console.error("Failed to check chats table structure:", err);
      return;
    }
    
    // Check if project_id column exists
    db.all(`PRAGMA table_info(chats)`, (infoErr, infoRows) => {
      if (infoErr) {
        console.error("Failed to inspect chats table structure:", infoErr);
        return;
      }
      
      const hasProjectId = infoRows.some(col => col.name === 'project_id');
      
      if (!hasProjectId) {
        console.log("Adding project_id column to 'chats' table...");
        
        db.run(`ALTER TABLE chats ADD COLUMN project_id INTEGER`, (alterErr) => {
          if (alterErr) {
            console.error("Failed to add project_id column:", alterErr);
          } else {
            console.log("Added project_id column to 'chats' table.");
          }
        });
      } else {
        console.log("'chats' table already has project_id column.");
      }
    });
  });

  // Check if the pdfs table already exists
  db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='pdfs'`, (err, row) => {
    if (err) {
      console.error("Failed to check for 'pdfs' table:", err);
      return;
    }

    if (row) {
      // The pdfs table exists, let's check if it has the file_content column
      db.all("PRAGMA table_info(pdfs)", (infoErr, infoRows) => {
        if (infoErr) {
          console.error("Failed to inspect table structure:", infoErr);
          return;
        }

        const hasFileContent = infoRows.some(col => col.name === 'file_content');
        const hasCascade = infoRows.some(row => row.on_delete && row.on_delete.toUpperCase() === 'CASCADE');
        
        if (!hasFileContent) {
          console.log("Adding file_content column to 'pdfs' table...");
          
          db.run(`ALTER TABLE pdfs ADD COLUMN file_content BLOB`);
          console.log("Added file_content column to 'pdfs' table.");
        }
        
        if (!hasCascade) {
          console.log("Migrating 'pdfs' table to support ON DELETE CASCADE...");

          db.serialize(() => {
            db.run(`
              CREATE TABLE IF NOT EXISTS pdfs_temp (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER,
                filename TEXT,
                filepath TEXT DEFAULT NULL,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                mimetype TEXT,
                file_content BLOB,
                FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
              )
            `);

            db.run(`
              INSERT INTO pdfs_temp (id, chat_id, filename, filepath, uploaded_at, mimetype, file_content)
              SELECT id, chat_id, filename, filepath, uploaded_at, mimetype, file_content FROM pdfs
            `);

            db.run(`DROP TABLE pdfs`);
            db.run(`ALTER TABLE pdfs_temp RENAME TO pdfs`);

            console.log("Migration completed: 'pdfs' now uses ON DELETE CASCADE and has file_content column.");
          });
        } else {
          console.log("'pdfs' table already has ON DELETE CASCADE and file_content column.");
        }
        
        // Clean up old filepath references for records that don't have file_content
        db.run(`UPDATE pdfs SET filepath = NULL WHERE file_content IS NULL AND filepath IS NOT NULL`, function(err) {
          if (err) {
            console.error("Failed to clean up old filepath references:", err);
          } else {
            console.log("Cleaned up old filepath references for records without file_content.");
          }
        });
      });
    } else {
      // Create the pdfs table with file_content BLOB and ON DELETE CASCADE
      db.run(`
        CREATE TABLE pdfs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id INTEGER,
          filename TEXT,
          filepath TEXT DEFAULT NULL,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          mimetype TEXT,
          file_content BLOB,
          FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
        )
      `);
      console.log("'pdfs' table created with file_content BLOB and ON DELETE CASCADE.");
    }
  });
});

module.exports = db;
