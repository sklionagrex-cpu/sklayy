from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_socketio import SocketIO, emit, join_room
import sqlite3
import hashlib
from datetime import datetime
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = 'sklay_secret'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max
socketio = SocketIO(app, cors_allowed_origins="*")

def get_db():
    conn = sqlite3.connect('sklay.db')
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

UPLOAD_FOLDER = 'static/uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

MEDIA_FOLDER = 'static/media'
if not os.path.exists(MEDIA_FOLDER):
    os.makedirs(MEDIA_FOLDER)

def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            full_name TEXT,
            email TEXT,
            phone TEXT,
            bio TEXT,
            avatar TEXT,
            status TEXT,
            online INTEGER DEFAULT 0,
            created_at TEXT
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            type TEXT,
            created_by INTEGER,
            created_at TEXT
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS chat_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER,
            user_id INTEGER,
            role TEXT
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER,
            user_id INTEGER,
            content TEXT,
            created_at TEXT,
            deleted INTEGER DEFAULT 0
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            friend_id INTEGER,
            status TEXT,
            created_at TEXT
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            content TEXT,
            media_url TEXT,
            created_at TEXT
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            user_id INTEGER,
            created_at TEXT
        )
    ''')
    # Добавляем колонку media_url если её нет
    try:
        conn.execute('ALTER TABLE posts ADD COLUMN media_url TEXT')
    except:
        pass
    conn.commit()
    conn.close()

init_db()

# ===== МАРШРУТЫ =====
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        conn = get_db()
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()
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
        conn = get_db()
        if conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone():
            conn.close()
            return render_template('auth.html', error='Пользователь существует', mode='register')
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

@app.route('/user/<username>')
def user_profile(username):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not user:
        conn.close()
        return redirect(url_for('messenger'))
    posts = conn.execute('''
        SELECT p.*, u.username, u.full_name, u.avatar,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
    ''', (user['id'],)).fetchall()
    conn.close()
    return render_template('user_profile.html', user=user, posts=posts, current_user=session.get('username'))

@app.route('/chat/<int:chat_id>')
def chat_view(chat_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = get_db()
    chat = conn.execute('SELECT * FROM chats WHERE id = ?', (chat_id,)).fetchone()
    members = conn.execute('''
        SELECT u.id, u.username, u.full_name, u.avatar, u.online
        FROM chat_members cm JOIN users u ON cm.user_id = u.id
        WHERE cm.chat_id = ?
    ''', (chat_id,)).fetchall()
    conn.close()
    return render_template('chat.html', chat=chat, members=members, username=session.get('username'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# ===== API =====
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

@app.route('/api/profile/settings', methods=['PUT'])
def update_settings():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    allowed = ['privacy_profile', 'privacy_messages', 'privacy_calls',
               'privacy_online', 'privacy_last_seen', 'privacy_invites',
               'theme', 'accent_color', 'font_size',
               'notifications_sound', 'notifications_vibration',
               'notifications_push', 'notifications_email']
    conn = get_db()
    for field in allowed:
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

@app.route('/api/upload_media', methods=['POST'])
def upload_media():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    if 'media' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['media']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    # Проверяем тип
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg']
    if file.content_type not in allowed_types:
        return jsonify({'error': 'Unsupported file type'}), 400
    if file.content_length > 50 * 1024 * 1024:
        return jsonify({'error': 'File too large (max 50MB)'}), 400
    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'bin'
    filename = f"media_{session['user_id']}_{int(datetime.now().timestamp())}.{ext}"
    filepath = os.path.join(MEDIA_FOLDER, filename)
    file.save(filepath)
    url = f"/static/media/{filename}"
    return jsonify({'url': url})

@app.route('/api/chats')
def get_chats():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    chats = conn.execute('''
        SELECT c.*, (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) as member_count
        FROM chats c JOIN chat_members cm ON c.id = cm.chat_id
        WHERE cm.user_id = ?
        ORDER BY c.created_at DESC
    ''', (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(chat) for chat in chats])

@app.route('/api/messages/<int:chat_id>')
def get_messages(chat_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    msgs = conn.execute('''
        SELECT m.*, u.username, u.full_name
        FROM messages m JOIN users u ON m.user_id = u.id
        WHERE m.chat_id = ? AND m.deleted = 0
        ORDER BY m.created_at ASC LIMIT 100
    ''', (chat_id,)).fetchall()
    conn.close()
    return jsonify([dict(m) for m in msgs])

@app.route('/api/create_chat', methods=['POST'])
def create_chat():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    username = request.json.get('username')
    conn = get_db()
    target = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not target:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    cursor = conn.cursor()
    cursor.execute('INSERT INTO chats (type, created_by, created_at) VALUES (?, ?, ?)',
                   ('private', session['user_id'], datetime.now().isoformat()))
    chat_id = cursor.lastrowid
    cursor.execute('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', (chat_id, session['user_id']))
    cursor.execute('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', (chat_id, target['id']))
    conn.commit()
    conn.close()
    return jsonify({'chat_id': chat_id})

@app.route('/api/create_group', methods=['POST'])
def create_group():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    name = data.get('name', 'Группа')
    members = data.get('members', [])
    if len(members) < 2:
        return jsonify({'error': 'Нужно минимум 2 участника'}), 400
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO chats (name, type, created_by, created_at) VALUES (?, ?, ?, ?)',
                   (name, 'group', session['user_id'], datetime.now().isoformat()))
    chat_id = cursor.lastrowid
    cursor.execute('INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)',
                   (chat_id, session['user_id'], 'admin'))
    for username in members:
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        if user:
            cursor.execute('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', (chat_id, user['id']))
    conn.commit()
    conn.close()
    return jsonify({'chat_id': chat_id})

@app.route('/api/messages/<int:chat_id>/<int:message_id>', methods=['PUT'])
def edit_message(chat_id, message_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    content = request.json.get('content')
    if not content:
        return jsonify({'error': 'Content required'}), 400
    conn = get_db()
    msg = conn.execute('SELECT * FROM messages WHERE id = ? AND user_id = ? AND chat_id = ?',
                       (message_id, session['user_id'], chat_id)).fetchone()
    if not msg:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    conn.execute('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?',
                 (content, datetime.now().isoformat(), message_id))
    conn.commit()
    conn.close()
    socketio.emit('message_edited', {'id': message_id, 'content': content, 'chat_id': chat_id}, room=f'chat_{chat_id}')
    return jsonify({'success': True})

@app.route('/api/messages/<int:chat_id>', methods=['DELETE'])
def delete_message(chat_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    message_id = request.json.get('message_id')
    conn = get_db()
    msg = conn.execute('SELECT * FROM messages WHERE id = ? AND user_id = ? AND chat_id = ?',
                       (message_id, session['user_id'], chat_id)).fetchone()
    if not msg:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    conn.execute('UPDATE messages SET deleted = 1, content = "Сообщение удалено" WHERE id = ?', (message_id,))
    conn.commit()
    conn.close()
    socketio.emit('message_deleted', {'chat_id': chat_id, 'message_id': message_id}, room=f'chat_{chat_id}')
    return jsonify({'success': True})

@app.route('/api/search_messages/<int:chat_id>')
def search_messages(chat_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    q = request.args.get('q', '')
    if len(q) < 2:
        return jsonify([])
    conn = get_db()
    msgs = conn.execute('''
        SELECT m.*, u.username, u.full_name
        FROM messages m JOIN users u ON m.user_id = u.id
        WHERE m.chat_id = ? AND m.deleted = 0 AND m.content LIKE ?
        ORDER BY m.created_at DESC LIMIT 50
    ''', (chat_id, f'%{q}%')).fetchall()
    conn.close()
    return jsonify([dict(m) for m in msgs])

@app.route('/api/friends')
def get_friends():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    friends = conn.execute('''
        SELECT u.id, u.username, u.full_name, u.avatar, u.online
        FROM friends f JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ? AND f.status = 'accepted'
        UNION
        SELECT u.id, u.username, u.full_name, u.avatar, u.online
        FROM friends f JOIN users u ON f.user_id = u.id
        WHERE f.friend_id = ? AND f.status = 'accepted'
    ''', (session['user_id'], session['user_id'])).fetchall()
    conn.close()
    return jsonify([dict(f) for f in friends])

@app.route('/api/friend_requests')
def get_friend_requests():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    reqs = conn.execute('''
        SELECT f.id as request_id, u.id, u.username, u.full_name, u.avatar
        FROM friends f JOIN users u ON f.user_id = u.id
        WHERE f.friend_id = ? AND f.status = 'pending'
    ''', (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in reqs])

@app.route('/api/friends', methods=['POST'])
def send_friend_request():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    username = request.json.get('username')
    conn = get_db()
    target = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not target:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    if target['id'] == session['user_id']:
        conn.close()
        return jsonify({'error': 'Cannot add yourself'}), 400
    existing = conn.execute('''
        SELECT * FROM friends
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    ''', (session['user_id'], target['id'], target['id'], session['user_id'])).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'Already sent'}), 400
    conn.execute('INSERT INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, ?, ?)',
                 (session['user_id'], target['id'], 'pending', datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/friends/<int:request_id>', methods=['PUT'])
def accept_friend(request_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    req = conn.execute('SELECT * FROM friends WHERE id = ? AND friend_id = ? AND status = "pending"',
                       (request_id, session['user_id'])).fetchone()
    if not req:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    conn.execute('UPDATE friends SET status = "accepted" WHERE id = ?', (request_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/friends/<int:request_id>', methods=['DELETE'])
def reject_friend(request_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    conn.execute('DELETE FROM friends WHERE id = ? AND friend_id = ? AND status = "pending"',
                 (request_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/blocked')
def get_blocked():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    blocked = conn.execute('''
        SELECT u.id, u.username, u.full_name, u.avatar
        FROM friends f JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ? AND f.status = 'blocked'
    ''', (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(b) for b in blocked])

@app.route('/api/block/<int:user_id>', methods=['POST'])
def block_user(user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    existing = conn.execute('''
        SELECT * FROM friends
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    ''', (session['user_id'], user_id, user_id, session['user_id'])).fetchone()
    if existing:
        conn.execute('UPDATE friends SET status = "blocked" WHERE id = ?', (existing['id'],))
    else:
        conn.execute('INSERT INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, ?, ?)',
                     (session['user_id'], user_id, 'blocked', datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/unblock/<int:user_id>', methods=['DELETE'])
def unblock_user(user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    conn.execute('DELETE FROM friends WHERE user_id = ? AND friend_id = ? AND status = "blocked"',
                 (session['user_id'], user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/delete_account', methods=['POST'])
def delete_account():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    password = request.json.get('password')
    if not password:
        return jsonify({'error': 'Password required'}), 400
    conn = get_db()
    user = conn.execute('SELECT password FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    if not user or user['password'] != hash_password(password):
        conn.close()
        return jsonify({'error': 'Wrong password'}), 401
    conn.execute('DELETE FROM messages WHERE user_id = ?', (session['user_id'],))
    conn.execute('DELETE FROM chat_members WHERE user_id = ?', (session['user_id'],))
    conn.execute('DELETE FROM friends WHERE user_id = ? OR friend_id = ?', (session['user_id'], session['user_id']))
    conn.execute('DELETE FROM users WHERE id = ?', (session['user_id'],))
    conn.commit()
    conn.close()
    session.clear()
    return jsonify({'success': True})

# ===== ПОСТЫ =====
@app.route('/api/posts')
def get_posts():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    posts = conn.execute('''
        SELECT p.*, u.username, u.full_name, u.avatar,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
    ''', (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(post) for post in posts])

@app.route('/api/posts', methods=['POST'])
def create_post():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    content = data.get('content', '')
    media_url = data.get('media_url', None)
    if not content and not media_url:
        return jsonify({'error': 'Content or media required'}), 400
    conn = get_db()
    conn.execute(
        'INSERT INTO posts (user_id, content, media_url, created_at) VALUES (?, ?, ?, ?)',
        (session['user_id'], content, media_url, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
def like_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    existing = conn.execute(
        'SELECT * FROM likes WHERE post_id = ? AND user_id = ?',
        (post_id, session['user_id'])
    ).fetchone()
    if existing:
        conn.execute(
            'DELETE FROM likes WHERE post_id = ? AND user_id = ?',
            (post_id, session['user_id'])
        )
    else:
        conn.execute(
            'INSERT INTO likes (post_id, user_id, created_at) VALUES (?, ?, ?)',
            (post_id, session['user_id'], datetime.now().isoformat())
        )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    post = conn.execute(
        'SELECT * FROM posts WHERE id = ? AND user_id = ?',
        (post_id, session['user_id'])
    ).fetchone()
    if not post:
        conn.close()
        return jsonify({'error': 'Post not found'}), 404
    conn.execute('DELETE FROM posts WHERE id = ?', (post_id,))
    conn.execute('DELETE FROM likes WHERE post_id = ?', (post_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ===== WEBSOCKET =====
@socketio.on('send_message')
def handle_send_message(data):
    chat_id = data.get('chat_id')
    content = data.get('content')
    user_id = session.get('user_id')
    if not user_id or not chat_id or not content:
        return
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO messages (chat_id, user_id, content, created_at) VALUES (?, ?, ?, ?)',
                   (chat_id, user_id, content, datetime.now().isoformat()))
    msg_id = cursor.lastrowid
    conn.commit()
    msg = conn.execute('''
        SELECT m.*, u.username, u.full_name
        FROM messages m JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
    ''', (msg_id,)).fetchone()
    conn.close()
    emit('new_message', dict(msg), room=f'chat_{chat_id}')

@socketio.on('join_chat')
def handle_join_chat(data):
    join_room(f'chat_{data.get("chat_id")}')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
