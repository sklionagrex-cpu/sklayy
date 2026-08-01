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

@app.route('/chat/<int:chat_id>')
def chat_view(chat_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    conn = get_db()
    chat = conn.execute('SELECT * FROM chats WHERE id = ?', (chat_id,)).fetchone()
    if not chat:
        conn.close()
        return redirect(url_for('messenger'))
    members = conn.execute('''
        SELECT u.id, u.username, u.full_name, u.avatar, u.online
        FROM chat_members cm JOIN users u ON cm.user_id = u.id
        WHERE cm.chat_id = ?
    ''', (chat_id,)).fetchall()
    conn.close()
    chat_name = chat['name']
    if chat['type'] == 'private':
        conn = get_db()
        other = conn.execute('''
            SELECT u.full_name, u.username FROM chat_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.chat_id = ? AND cm.user_id != ?
        ''', (chat_id, session['user_id'])).fetchone()
        conn.close()
        if other:
            chat_name = other['full_name'] or other['username']
    return render_template('chat.html', chat=chat, members=members, username=session.get('username'), chat_name=chat_name)

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

@app.route('/api/chats')
def get_chats():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    chats = conn.execute('''
        SELECT c.*, 
               (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) as member_count
        FROM chats c 
        JOIN chat_members cm ON c.id = cm.chat_id 
        WHERE cm.user_id = ? 
        GROUP BY c.id
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
    target = get_user_by_username(username)
    if not target:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    
    # Проверяем существующий чат
    existing = conn.execute('''
        SELECT c.id, c.name FROM chats c
        JOIN chat_members cm1 ON c.id = cm1.chat_id
        JOIN chat_members cm2 ON c.id = cm2.chat_id
        WHERE c.type = 'private' 
        AND cm1.user_id = ? AND cm2.user_id = ?
    ''', (session['user_id'], target['id'])).fetchone()
    
    if existing:
        # ВСЕГДА обновляем имя чата на имя собеседника
        chat_name = target['full_name'] or target['username']
        conn.execute('UPDATE chats SET name = ? WHERE id = ?', (chat_name, existing['id']))
        conn.commit()
        conn.close()
        return jsonify({'chat_id': existing['id']})
    
    # Создаём новый чат с именем собеседника
    chat_name = target['full_name'] or target['username']
    cursor = conn.cursor()
    cursor.execute('INSERT INTO chats (name, type, created_by, created_at) VALUES (?, ?, ?, ?)',
                   (chat_name, 'private', session['user_id'], datetime.now().isoformat()))
    chat_id = cursor.lastrowid
    cursor.execute('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', (chat_id, session['user_id']))
    cursor.execute('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', (chat_id, target['id']))
    conn.commit()
    conn.close()
    return jsonify({'chat_id': chat_id})

@app.route('/api/friends')
def get_friends():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    friends = conn.execute('''
        SELECT u.id, u.username, u.full_name, u.avatar, u.online
        FROM friends f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ? AND f.status = 'accepted'
        UNION
        SELECT u.id, u.username, u.full_name, u.avatar, u.online
        FROM friends f
        JOIN users u ON f.user_id = u.id
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
    target = get_user_by_username(username)
    if not target:
        return jsonify({'error': 'User not found'}), 404
    if target['id'] == session['user_id']:
        return jsonify({'error': 'Cannot add yourself'}), 400
    conn = get_db()
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

@app.route('/api/posts')
def get_posts():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    posts = conn.execute('''
        SELECT p.*, u.username, u.full_name, u.avatar,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
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

@app.route('/api/posts/<int:post_id>/comments')
def get_comments(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    comments = conn.execute('''
        SELECT c.*, u.username, u.full_name, u.avatar
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    ''', (post_id,)).fetchall()
    conn.close()
    return jsonify([dict(c) for c in comments])

@app.route('/api/posts/<int:post_id>/comments', methods=['POST'])
def add_comment(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    content = data.get('content', '')
    media_url = data.get('media_url', None)
    if not content and not media_url:
        return jsonify({'error': 'Content or media required'}), 400
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO comments (post_id, user_id, content, media_url, created_at) VALUES (?, ?, ?, ?, ?)',
        (post_id, session['user_id'], content, media_url, datetime.now().isoformat())
    )
    conn.commit()
    comment = conn.execute('''
        SELECT c.*, u.username, u.full_name, u.avatar
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
    ''', (cursor.lastrowid,)).fetchone()
    conn.close()
    return jsonify(dict(comment))

@app.route('/api/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    comment = conn.execute(
        'SELECT * FROM comments WHERE id = ? AND user_id = ?',
        (comment_id, session['user_id'])
    ).fetchone()
    if not comment:
        conn.close()
        return jsonify({'error': 'Comment not found'}), 404
    conn.execute('DELETE FROM comments WHERE id = ?', (comment_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/feed')
def get_feed():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    posts = get_feed_posts(session['user_id'])
    return jsonify([dict(p) for p in posts])

@app.route('/api/chat_users/<int:chat_id>')
def get_chat_users(chat_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    users = conn.execute('''
        SELECT u.id, u.username, u.full_name, u.avatar, u.online
        FROM chat_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.chat_id = ? AND u.id != ?
    ''', (chat_id, session['user_id'])).fetchall()
    conn.close()
    if users:
        return jsonify(dict(users[0]))
    return jsonify({'error': 'No users found'}), 404

@app.route('/api/friends_with_chat')
def get_friends_with_chat():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    friends = conn.execute('''
        SELECT u.id, u.username, u.full_name, u.avatar, u.online,
               (SELECT c.id FROM chats c
                JOIN chat_members cm1 ON c.id = cm1.chat_id
                JOIN chat_members cm2 ON c.id = cm2.chat_id
                WHERE c.type = 'private'
                AND cm1.user_id = ? AND cm2.user_id = u.id) as chat_id
        FROM friends f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ? AND f.status = 'accepted'
        UNION
        SELECT u.id, u.username, u.full_name, u.avatar, u.online,
               (SELECT c.id FROM chats c
                JOIN chat_members cm1 ON c.id = cm1.chat_id
                JOIN chat_members cm2 ON c.id = cm2.chat_id
                WHERE c.type = 'private'
                AND cm1.user_id = ? AND cm2.user_id = u.id) as chat_id
        FROM friends f
        JOIN users u ON f.user_id = u.id
        WHERE f.friend_id = ? AND f.status = 'accepted'
    ''', (session['user_id'], session['user_id'], session['user_id'], session['user_id'])).fetchall()
    conn.close()
    return jsonify([dict(f) for f in friends])

@app.route('/api/upload_media', methods=['POST'])
def upload_media():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    if 'media' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['media']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
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

@app.route('/api/delete_chat/<int:chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    member = conn.execute(
        'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
        (chat_id, session['user_id'])
    ).fetchone()
    if not member:
        conn.close()
        return jsonify({'error': 'Not a member'}), 403
    chat = conn.execute('SELECT type FROM chats WHERE id = ?', (chat_id,)).fetchone()
    if chat['type'] == 'private':
        conn.execute(
            'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?',
            (chat_id, session['user_id'])
        )
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'type': 'private'})
    else:
        if member['role'] == 'admin':
            conn.execute('DELETE FROM messages WHERE chat_id = ?', (chat_id,))
            conn.execute('DELETE FROM chat_members WHERE chat_id = ?', (chat_id,))
            conn.execute('DELETE FROM chats WHERE id = ?', (chat_id,))
            conn.commit()
            conn.close()
            return jsonify({'success': True, 'type': 'group'})
        else:
            conn.execute(
                'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?',
                (chat_id, session['user_id'])
            )
            conn.commit()
            conn.close()
            return jsonify({'success': True, 'type': 'leave_group'})

@app.route('/api/delete_chat_both/<int:chat_id>', methods=['DELETE'])
def delete_chat_both(chat_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    member = conn.execute(
        'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
        (chat_id, session['user_id'])
    ).fetchone()
    if not member:
        conn.close()
        return jsonify({'error': 'Not a member'}), 403
    chat = conn.execute('SELECT type FROM chats WHERE id = ?', (chat_id,)).fetchone()
    if chat['type'] == 'private':
        conn.execute('DELETE FROM messages WHERE chat_id = ?', (chat_id,))
        conn.execute('DELETE FROM chat_members WHERE chat_id = ?', (chat_id,))
        conn.execute('DELETE FROM chats WHERE id = ?', (chat_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    else:
        conn.close()
        return jsonify({'error': 'Only private chats can be deleted for both'}), 400

@socketio.on('send_message')
def handle_send_message(data):
    chat_id = data.get('chat_id')
    content = data.get('content')
    file_url = data.get('file_url')
    user_id = session.get('user_id')
    if not user_id or not chat_id:
        return
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO messages (chat_id, user_id, content, file_url, created_at) VALUES (?, ?, ?, ?, ?)',
        (chat_id, user_id, content, file_url, datetime.now().isoformat())
    )
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
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
