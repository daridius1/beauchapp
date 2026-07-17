import sqlite3
import random
import string
import datetime

DB_PATH = './backend/pb_data/data.db'

def random_string(length):
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

def random_token(length=50):
    chars = string.ascii_letters + string.digits + '_'
    return ''.join(random.choice(chars) for _ in range(length))

def main():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    dummy_data = [
        {
            "email": "dummy1.perez@ing.uchile.cl",
            "name": "Carlos Pérez",
            "username": "carlosp",
            "description": "Hola! Soy Carlos, estudio geofísica y me gusta hacer senderismo, leer ciencia ficción y tomar café. ¡Hablemos!",
            "instagram": "carlosp_geo",
            "whatsapp": "+56911111111"
        },
        {
            "email": "dummy2.gomez@ing.uchile.cl",
            "name": "Ana Gómez",
            "username": "anag",
            "description": "Estudiante de ingeniería industrial. Amante de los libros de finanzas, el tenis y viajar. ¿Sale su partido?",
            "instagram": "ana_gomez_ind",
            "whatsapp": "+56922222222"
        },
        {
            "email": "dummy3.soto@ing.uchile.cl",
            "name": "Andrés Soto",
            "username": "andress",
            "description": "Plan común, me gusta la música electrónica, el diseño web y la pizza de piña. Busco gente buena onda.",
            "instagram": "andres_soto_pc",
            "whatsapp": "+56933333333"
        },
        {
            "email": "dummy4.silva@ing.uchile.cl",
            "name": "Camila Silva",
            "username": "camilas",
            "description": "Buscando amigos para estudiar física y tomar chelas. Toco el teclado y amo los gatos. 🐱",
            "instagram": "camila_silva_cat",
            "whatsapp": "+56944444444"
        },
        {
            "email": "dummy5.rojas@ing.uchile.cl",
            "name": "Eduardo Rojas",
            "username": "eduardor",
            "description": "Estudiante de ingeniería eléctrica. Aficionado a la robótica, el ajedrez y el ciclismo. ¡Desafíame a una partida!",
            "instagram": "edu_rojas_ee",
            "whatsapp": "+56955555555"
        }
    ]

    # Bcrypt hash de 'password123'
    generic_password_hash = '$2a$10$vU3Csfbnp.vRJ6EJ5n6OSO1omp4M32RX22znRZ8m9ar2ykp0/H9jW'
    # Imagenes vacias por defecto para obligar a usar el placeholder de "Sin fotos subidas"
    dummy_photos = '[]'

    now_str = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.000Z')

    print("Sembrando cuentas dummy para pruebas...")

    for d in dummy_data:
        # Verificar si ya existe
        c.execute("SELECT id FROM users WHERE email=?", (d["email"],))
        res = c.fetchone()
        if res:
            user_id = res[0]
            print(f"El usuario {d['email']} ya existe (ID: {user_id}). Actualizando contraseña...")
            c.execute("UPDATE users SET password=? WHERE id=?", (generic_password_hash, user_id))
        else:
            # Crear usuario
            user_id = random_string(15)
            token_key = random_token(50)
            c.execute("""
                INSERT INTO users (
                    id, created, updated, email, emailVisibility, 
                    verified, name, username, password, tokenKey, type, subtype
                ) VALUES (?, ?, ?, ?, 0, 1, ?, ?, ?, ?, 'student', '')
            """, (user_id, now_str, now_str, d["email"], d["name"], d["username"], generic_password_hash, token_key))
            print(f"Usuario {d['name']} ({d['email']}) creado con éxito (ID: {user_id}).")

        # Verificar si tiene perfil de Tinder
        c.execute("SELECT id FROM tinder_profiles WHERE user=?", (user_id,))
        prof_res = c.fetchone()
        if prof_res:
            print(f"El perfil de Tinder para el usuario {d['name']} ya existe. Actualizando fotos y limpiando...")
            c.execute("UPDATE tinder_profiles SET photos=?, isActive=1 WHERE user=?", (dummy_photos, user_id))
        else:
            # Crear perfil de Tinder
            prof_id = random_string(15)
            c.execute("""
                INSERT INTO tinder_profiles (
                    id, created, updated, user, description, isActive, 
                    activatedAt, photos, instagram, whatsapp, telegram, signal
                ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, '', '')
            """, (prof_id, now_str, now_str, user_id, d["description"], now_str, dummy_photos, d["instagram"], d["whatsapp"]))
            print(f"Perfil de Tinder para {d['name']} creado con éxito.")

    conn.commit()
    conn.close()
    print("Semilla finalizada exitosamente.")

if __name__ == '__main__':
    main()
