import os

MAIN_HOOK_PATH = './backend/pb_hooks/main.pb.js'
HOOKS_DIR = './backend/pb_hooks/'

def main():
    if not os.path.exists(MAIN_HOOK_PATH):
        print(f"Error: {MAIN_HOOK_PATH} no existe.")
        return

    with open(MAIN_HOOK_PATH, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    print(f"Leídas {len(lines)} líneas de main.pb.js")

    header = "/// <reference path=\"../pb_data/types.d.ts\" />\n\n"

    # auth.pb.js: 4:84, 225:274, 275:1090
    auth_lines = (
        lines[3:84] + 
        ["\n"] + 
        lines[224:274] + 
        ["\n"] + 
        lines[274:1090]
    )
    with open(os.path.join(HOOKS_DIR, 'auth.pb.js'), 'w', encoding='utf-8') as f:
        f.write(header)
        f.writelines(auth_lines)
    print("Creado auth.pb.js")

    # forum.pb.js: 87:224
    forum_lines = lines[86:224]
    with open(os.path.join(HOOKS_DIR, 'forum.pb.js'), 'w', encoding='utf-8') as f:
        f.write(header)
        f.writelines(forum_lines)
    print("Creado forum.pb.js")

    # problems.pb.js: 1091:1335
    problems_lines = lines[1090:1335]
    with open(os.path.join(HOOKS_DIR, 'problems.pb.js'), 'w', encoding='utf-8') as f:
        f.write(header)
        f.writelines(problems_lines)
    print("Creado problems.pb.js")

    # tinder.pb.js: 1336:1452
    tinder_lines = lines[1335:1452]
    with open(os.path.join(HOOKS_DIR, 'tinder.pb.js'), 'w', encoding='utf-8') as f:
        f.write(header)
        f.writelines(tinder_lines)
    print("Creado tinder.pb.js")

    # notifications.pb.js: 1453:1497
    notifications_lines = lines[1452:1497]
    with open(os.path.join(HOOKS_DIR, 'notifications.pb.js'), 'w', encoding='utf-8') as f:
        f.write(header)
        f.writelines(notifications_lines)
    print("Creado notifications.pb.js")

    # Eliminar main.pb.js
    os.remove(MAIN_HOOK_PATH)
    print("Eliminado main.pb.js")

if __name__ == '__main__':
    main()
