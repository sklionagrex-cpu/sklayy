import sqlite3
import shutil
from datetime import datetime

def backup_database():
    try:
        shutil.copy2('sklay.db', f'sklay_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db')
        print("✅ Бэкап создан")
    except Exception as e:
        print(f"❌ Ошибка бэкапа: {e}")

if __name__ == '__main__':
    backup_database()
