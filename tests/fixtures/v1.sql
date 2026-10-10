
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY, canonical TEXT UNIQUE NOT NULL, locator TEXT NOT NULL,
        title TEXT NOT NULL, description TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', keywords TEXT NOT NULL DEFAULT '[]',
        favorite INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'local', error TEXT NOT NULL DEFAULT '',
        embedding TEXT, embedding_model TEXT
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        title, locator, description, summary, tags, keywords,
        content='items', content_rowid='rowid', tokenize='porter unicode61'
      );
      CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid,title,locator,description,summary,tags,keywords)
          VALUES(new.rowid,new.title,new.locator,new.description,new.summary,new.tags,new.keywords);
      END;
      CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts,rowid,title,locator,description,summary,tags,keywords)
          VALUES('delete',old.rowid,old.title,old.locator,old.description,old.summary,old.tags,old.keywords);
      END;
      CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts,rowid,title,locator,description,summary,tags,keywords)
          VALUES('delete',old.rowid,old.title,old.locator,old.description,old.summary,old.tags,old.keywords);
        INSERT INTO items_fts(rowid,title,locator,description,summary,tags,keywords)
          VALUES(new.rowid,new.title,new.locator,new.description,new.summary,new.tags,new.keywords);
      END;
      CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version = 1;
    