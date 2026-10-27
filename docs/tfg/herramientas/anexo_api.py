"""Genera la tabla del anexo A de la memoria (índice de la API) a partir de las rutas reales.

Uso, desde la raíz del repositorio:
    cd backend && php artisan route:list --path=api --except-vendor --json > ../rutas.json && cd ..
    python docs/tfg/herramientas/anexo_api.py rutas.json > tabla.md

Las descripciones cortas se mantienen a mano en DESC; si aparece una ruta nueva sin
descripción, sale marcada como PENDIENTE para que no pase desapercibida.
"""
import json
import sys

GRUPOS = [
    ("Salud y autenticación", ("api/v1/health", "api/v1/auth")),
    ("Cuenta del usuario", ("api/v1/me",)),
    ("Espacios de trabajo y miembros", ("api/v1/workspaces",)),
    ("Vehículos y su seguimiento", ("api/v1/vehicles", "api/v1/mileage", "api/v1/maintenance",
                                    "api/v1/expenses", "api/v1/reminders", "api/v1/documents")),
    ("Taller: clientes y órdenes", ("api/v1/customers", "api/v1/work-orders")),
]

DESC = {
    "GET api/v1/health": "Comprobación de salud",
    "POST api/v1/auth/register": "Registro; crea el espacio personal",
    "POST api/v1/auth/login": "Inicio de sesión (5 intentos por minuto, en `LoginRequest`)",
    "POST api/v1/auth/logout": "Cierre de sesión",
    "POST api/v1/auth/forgot-password": "Pedir el enlace de recuperación",
    "POST api/v1/auth/reset-password": "Fijar una contraseña nueva con el enlace",
    "GET api/v1/me": "Usuario actual",
    "PATCH api/v1/me": "Editar nombre y email",
    "DELETE api/v1/me": "Baja de la cuenta",
    "PUT api/v1/me/password": "Cambiar la contraseña",
    "GET api/v1/workspaces": "Espacios del usuario con su rol",
    "POST api/v1/workspaces": "Crear un taller",
    "GET api/v1/workspaces/{workspace}": "Ver un espacio",
    "PATCH api/v1/workspaces/{workspace}": "Ajustes del taller",
    "DELETE api/v1/workspaces/{workspace}": "Eliminar un taller",
    "GET api/v1/workspaces/{workspace}/dashboard": "Panel de inicio o centro de control",
    "GET api/v1/workspaces/{workspace}/activity": "Registro de actividad",
    "GET api/v1/workspaces/{workspace}/analytics": "Analítica del espacio",
    "GET api/v1/workspaces/{workspace}/reminders": "Agenda de recordatorios",
    "GET api/v1/workspaces/{workspace}/members": "Listar miembros",
    "POST api/v1/workspaces/{workspace}/members": "Añadir un miembro ya registrado",
    "PATCH api/v1/workspaces/{workspace}/members/{user}": "Cambiar el rol de un miembro",
    "DELETE api/v1/workspaces/{workspace}/members/{user}": "Quitar un miembro o salir del taller",
    "GET api/v1/workspaces/{workspace}/vehicles": "Listar vehículos",
    "POST api/v1/workspaces/{workspace}/vehicles": "Alta de vehículo",
    "GET api/v1/workspaces/{workspace}/customers": "Listar clientes",
    "POST api/v1/workspaces/{workspace}/customers": "Alta de cliente",
    "GET api/v1/workspaces/{workspace}/work-orders": "Listar órdenes (tablero)",
    "POST api/v1/workspaces/{workspace}/work-orders": "Crear una orden",
    "GET api/v1/workspaces/{workspace}/bays": "Ocupación de los elevadores",
    "GET api/v1/vehicles/{vehicle}": "Ficha del vehículo",
    "PATCH api/v1/vehicles/{vehicle}": "Editar el vehículo",
    "DELETE api/v1/vehicles/{vehicle}": "Eliminar un vehículo archivado",
    "POST api/v1/vehicles/{vehicle}/archive": "Archivar",
    "POST api/v1/vehicles/{vehicle}/restore": "Restaurar",
    "GET api/v1/vehicles/{vehicle}/summary": "Resumen de gastos y coste por km",
    "GET api/v1/vehicles/{vehicle}/zones": "Estado de las 10 zonas",
    "GET api/v1/vehicles/{vehicle}/journal": "Diario por días",
    "GET api/v1/vehicles/{vehicle}/report": "Datos del informe del vehículo",
    "GET api/v1/vehicles/{vehicle}/mileage": "Lecturas de km con su origen",
    "POST api/v1/vehicles/{vehicle}/mileage": "Nueva lectura de km",
    "DELETE api/v1/mileage/{mileageLog}": "Borrar una lectura manual",
    "GET api/v1/vehicles/{vehicle}/maintenance": "Historial de intervenciones",
    "POST api/v1/vehicles/{vehicle}/maintenance": "Registrar una intervención",
    "GET api/v1/maintenance/{maintenanceRecord}": "Detalle de una intervención",
    "PATCH api/v1/maintenance/{maintenanceRecord}": "Editar una intervención",
    "POST api/v1/maintenance/{maintenanceRecord}/archive": "Archivar una intervención",
    "POST api/v1/maintenance/{maintenanceRecord}/restore": "Restaurar una intervención",
    "GET api/v1/vehicles/{vehicle}/expenses": "Listar gastos",
    "POST api/v1/vehicles/{vehicle}/expenses": "Registrar un gasto",
    "PATCH api/v1/expenses/{expense}": "Editar un gasto manual",
    "DELETE api/v1/expenses/{expense}": "Borrar un gasto manual",
    "GET api/v1/vehicles/{vehicle}/reminders": "Listar recordatorios",
    "POST api/v1/vehicles/{vehicle}/reminders": "Crear un recordatorio",
    "PATCH api/v1/reminders/{reminder}": "Editar un recordatorio",
    "DELETE api/v1/reminders/{reminder}": "Borrar un recordatorio",
    "POST api/v1/reminders/{reminder}/complete": "Completarlo (crea el siguiente si es recurrente)",
    "POST api/v1/reminders/{reminder}/dismiss": "Descartarlo",
    "GET api/v1/vehicles/{vehicle}/documents": "Listar documentos",
    "POST api/v1/vehicles/{vehicle}/documents": "Subir un documento",
    "GET api/v1/documents/{document}/download": "Descargar o previsualizar",
    "DELETE api/v1/documents/{document}": "Borrar un documento",
    "GET api/v1/customers/{customer}": "Ficha del cliente",
    "PATCH api/v1/customers/{customer}": "Editar el cliente",
    "DELETE api/v1/customers/{customer}": "Borrar el cliente (sin órdenes abiertas)",
    "GET api/v1/customers/{customer}/vehicles": "Vehículos del cliente",
    "POST api/v1/customers/{customer}/export": "Exportar sus datos en JSON (RGPD)",
    "POST api/v1/customers/{customer}/anonymize": "Anonimizarlo (RGPD)",
    "GET api/v1/work-orders/{workOrder}": "Detalle de la orden",
    "PATCH api/v1/work-orders/{workOrder}": "Editar la orden y sus líneas",
    "DELETE api/v1/work-orders/{workOrder}": "Borrar una orden recibida o cancelada",
    "POST api/v1/work-orders/{workOrder}/status": "Cambiar el estado (entregar crea la intervención)",
}

ORDEN_METODO = {"GET|HEAD": 0, "POST": 1, "PUT": 2, "PATCH": 3, "DELETE": 4}


def permiso(middleware):
    capacidad, sesion, limite = None, False, False
    for m in middleware:
        m = m.split("\\")[-1]
        if m.startswith("Authenticate"):
            sesion = True
        elif m.startswith("Authorize:") and capacidad is None:
            capacidad = m.split(":")[1].split(",")[0]
        elif m.startswith("ThrottleRequests"):
            limite = True
    if capacidad:
        return "`" + capacidad + "`"
    if sesion:
        return "Sesión"
    return "Pública" + (" (5/min)" if limite else "")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    with open(sys.argv[1], encoding="utf-8") as f:
        rutas = json.load(f)
    total = 0
    for titulo, prefijos in GRUPOS:
        filas = [r for r in rutas if r["uri"].startswith(prefijos)]
        filas.sort(key=lambda r: (r["uri"], ORDEN_METODO.get(r["method"], 9)))
        print(f"\n**{titulo}** ({len(filas)} rutas)\n")
        print("| Método | Ruta | Controlador | Permiso | Uso |")
        print("|--------|------|-------------|---------|-----|")
        for r in filas:
            metodo = r["method"].replace("|HEAD", "")
            clave = f"{metodo} {r['uri']}"
            accion = r["action"].replace("App\\Http\\Controllers\\", "")
            uso = DESC.get(clave, "PENDIENTE: describir")
            print(f"| {metodo} | `/{r['uri']}` | `{accion}` | {permiso(r['middleware'])} | {uso} |")
            total += 1
    print(f"\nTotal: {total} de {len(rutas)} rutas.")


if __name__ == "__main__":
    main()
