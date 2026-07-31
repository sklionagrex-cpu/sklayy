import sqlite3
import shutil
import os
from datetime import datetime

DB_PATH = 'sklay.db'
BACKUP_DIR = 'backups'

def backup_db():
    if os.path.exists(DB_PATH):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(BACKUP_DIR, f"sklay_backup_{timestamp}.db")
        shutil.copy2(DB_PATH, backup_path)
        print(f"✅ Бэкап создан: {backup_path}")
        return True
    return False

def restore_last_backup():
    if not os.path.exists(BACKUP_DIR):
        return False
    backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith('.db')], reverse=True)
    if backups:
        latest = os.path.join(BACKUP_DIR, backups[0])
        shutil.copy2(latest, DB_PATH)
        print(f"✅ Восстановлена база из: {latest}")
        return True
    return False

if __name__ == '__main__':
    if not os.path.exists(DB_PATH):
        print("⚠️ База данных не найдена. Восстанавливаем из бэкапа...")
        if not restore_last_backup():
            print("ℹ️ Бэкапов нет. Будет создана новая база.")
    else:
        print("✅ База данных найдена. Создаём бэкап...")
        backup_db()
