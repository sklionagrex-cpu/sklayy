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
    conn.execute('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, user_id INTEGER, content TEXT, file_url TEXT, created_at TEXT, deleted INTEGER DEFAULT 0)')
    conn.execute('CREATE TABLE IF NOT EXISTS friends (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, friend_id INTEGER, status TEXT, created_at TEXT)')
    conn.execute('CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, content TEXT, media_url TEXT, created_at TEXT)')
    conn.execute('CREATE TABLE IF NOT EXISTS likes (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, user_id INTEGER, created_at TEXT)')
    conn.execute('CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, user_id INTEGER, content TEXT, media_url TEXT, created_at TEXT)')
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
    posts = conn.execute('''
        SELECT p.*, u.username, u.full_name, u.avatar,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
        FROM posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
    ''').fetchall()
    conn.close()
    return posts

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = get_user_by_username(username)
        if user and user['password'] == hash_password(password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            return redirect(url_for('messenger'))
        return render_template('auth.html', error='Неверный логин', mode='login')
    return render_template('auth.html', mode='login')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        confirm = request.form.get('confirm')
        if password != confirm:
            return render_template('auth.html', error='Пароли не совпадают', mode='register')
        if len(password) < 6:
            return render_template('auth.html', error='Пароль минимум 6 символов', mode='register')
        if get_user_by_username(username):
            return render_template('auth.html', error='Пользователь существует', mode='register')
        conn = get_db()
        conn.execute('INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)',
                     (username, hash_password(password), datetime.now().isoformat()))
        conn.commit()
        conn.close()
        return redirect(url_for('login'))
    return render_template('auth.html', mode='register')

@app.route('/app')
def messenger():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('messenger.html', username=session.get('username'))

@app.route('/profile')
def profile_page():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    conn.close()
    return render_template('profile.html', user=user)

@app.route('/profile/edit')
def edit_profile():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    conn.close()
    return render_template('edit_profile.html', user=user)


@app.route('/post/<int:post_id>')
def post_detail(post_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('post_detail.html', post_id=post_id)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/api/profile')
def get_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    conn.close()
    return jsonify(dict(user))

@app.route('/api/profile', methods=['PUT'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    conn = get_db()
    for field in ['full_name', 'email', 'phone', 'bio', 'status', 'avatar']:
        if field in data:
            conn.execute(f'UPDATE users SET {field} = ? WHERE id = ?', (data[field], session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/upload_avatar', methods=['POST'])
def upload_avatar():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    if 'avatar' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['avatar']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'jpg'
    filename = f"user_{session['user_id']}_{int(datetime.now().timestamp())}.{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    url = f"/static/uploads/{filename}"
    conn = get_db()
    conn.execute('UPDATE users SET avatar = ? WHERE id = ?', (url, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'url': url})

