# Beauchapp Backend ⚙️

El backend de Beauchapp utiliza [PocketBase](https://pocketbase.io/), un backend monolítico ligero en Go que utiliza SQLite como base de datos local.

## Archivos de Lógica de Negocio (pb_hooks)

Toda la lógica de negocio personalizada y crítica (como la verificación de dominios de correo electrónico universitarios y el algoritmo de cálculo de ELO) se encuentra en la carpeta `pb_hooks/`.

*   **`pb_hooks/main.pb.js`**: Contiene los hooks del ciclo de vida de PocketBase para interceptar solicitudes de creación de registros y operaciones de resultados de partidas.

## Configuración y Ejecución Local

Para levantar el backend localmente en Ubuntu:

1.  **Descargar PocketBase** (Linux AMD64):
    ```bash
    wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.14/pocketbase_0.22.14_linux_amd64.zip
    ```
    *(Nota: Reemplazar con la versión deseada de ser necesario).*

2.  **Descomprimir el archivo zip**:
    ```bash
    unzip pocketbase_0.22.14_linux_amd64.zip -d backend/
    rm pocketbase_0.22.14_linux_amd64.zip
    ```

3.  **Dar permisos de ejecución**:
    ```bash
    chmod +x backend/pocketbase
    ```

4.  **Iniciar el Servidor**:
    ```bash
    cd backend
    ./pocketbase serve
    ```

El panel de administración estará en [http://127.0.0.1:8090/_/](http://127.0.0.1:8090/_/).
