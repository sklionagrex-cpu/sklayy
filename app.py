from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_socketio import SocketIO, emit, join_room
import sqlite3
import hashlib
from datetime import datetime
import os
import shutil

app = Flask(__name__)
app.secret_key = 'sklay_secret'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
socketio = SocketIO(app, cors_allowed_origins="*")

DB_PATH = 'sklay.db'
BACKUP_DIR = 'backups'
os.makedirs(BACKUP_DIR, exist_ok=True)

if os.path.exists(DB_PATH):
    shutil.copy2(DB_PATH, os.path.join(BACKUP_DIR, f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"))
else:
    backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith('.db')], reverse=True)
    if backups:
        shutil.copy2(os.path.join(BACKUP_DIR, backups[0]), DB_PATH)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

UPLOAD_FOLDER = 'static/uploads'
MEDIA_FOLDER = 'static/media'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(MEDIA_FOLDER, exist_ok=True)

def init_db():
    conn = get_db()
    conn.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, full_name TEXT, email TEXT, phone TEXT, bio TEXT, avatar TEXT, status TEXT, online INTEGER DEFAULT 0, created_at TEXT)')
    conn.execute('CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, created_by INTEGER, created_at TEXT)')
    conn.execute('CREATE TABLE IF NOT EXISTS chat_members (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, user_id INTEGER, role TEXT)')
    conn.execute('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, user_id INTEGER, content TEXT, file_url TEXT, file_type TEXT, created_at TEXT, deleted INTEGER DEFAULT 0)')
    conn.execute('CREATE TABLE IF NOT EXISTS friends (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, friend_id INTEGER, status TEXT, created_at TEXT)')
    conn.execute('CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, community_id INTEGER, content TEXT, media_url TEXT, created_at TEXT)')
    conn.execute('CREATE TABLE IF NOT EXISTS likes (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, user_id INTEGER, created_at TEXT)')
    conn.execute('CREATE TABLE IF NOT EXISTS communities (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, avatar TEXT, created_by INTEGER, created_at TEXT, FOREIGN KEY (created_by) REFERENCES users (id))')
    conn.execute('CREATE TABLE IF NOT EXISTS community_members (id INTEGER PRIMARY KEY AUTOINCREMENT, community_id INTEGER, user_id INTEGER, role TEXT DEFAULT "member", joined_at TEXT, FOREIGN KEY (community_id) REFERENCES communities (id), FOREIGN KEY (user_id) REFERENCES users (id))')
    conn.execute('CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, user_id INTEGER, content TEXT, media_url TEXT, created_at TEXT, FOREIGN KEY (post_id) REFERENCES posts (id), FOREIGN KEY (user_id) REFERENCES users (id))')
    try:
        conn.execute('ALTER TABLE posts ADD COLUMN community_id INTEGER')
    except:
        pass
    conn.commit()
    conn.close()

init_db()

def get_user_by_username(username):
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    return user

def get_feed_posts(user_id):
    conn = get_db()
    posts = conn.execute('SELECT p.*, u.username, u.full_name, u.avatar, (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes, c.name as community_name FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN communities c ON p.community_id = c.id ORDER BY p.created_at DESC').fetchall()
    conn.close()
    return posts

def is_community_admin(community_id, user_id):
    conn = get_db()
    admin = conn.execute('SELECT * FROM community_members WHERE community_id = ? AND user_id = ? AND role = "admin"', (community_id, user_id)).fetchone()
    conn.close()
    return admin is not None

